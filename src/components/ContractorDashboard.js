// ContractorDashboard.js (fixed)
// - Removes .clone() usage (Supabase query builders don't support it)
// - Resolves contractor by lowercase email
// - Accept / Reject / Final Report flows
// - Slightly safer Set state updates

import React, { useEffect, useMemo, useState, useCallback } from "react";
// Adjust import to your project structure
import { supabase } from "../supabase";

export default function ContractorDashboard() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null); // contractor row
  const [errorMsg, setErrorMsg] = useState("");

  const [pending, setPending] = useState([]);   // status = 'assigned' (awaiting accept/reject)
  const [active, setActive] = useState([]);     // status = 'accepted'
  const [history, setHistory] = useState([]);   // status in ('rejected','completed')

  const [finalReportOpenFor, setFinalReportOpenFor] = useState(null); // assignment id
  const [finalReportText, setFinalReportText] = useState("");
  const [busyIds, setBusyIds] = useState(new Set());

  const emailLower = useMemo(() => session?.user?.email?.toLowerCase() ?? null, [session]);

  // --- bootstrap session ---
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setSession(data.session);
    })();
    return () => { isMounted = false; };
  }, []);

  // --- resolve contractor by lowercase email ---
  useEffect(() => {
    if (!emailLower) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      setErrorMsg("");
      const { data, error } = await supabase
        .from("contractors")
        .select("id, full_name, email, phone, services_provided")
        .eq("email", emailLower) // DB normalized to lowercase recommended
        .single();

      if (cancelled) return;

      if (error || !data) {
        setMe(null);
        setLoading(false);
        setErrorMsg("No matching contractor record found for this account. Contact admin.");
        return;
      }

      setMe(data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [emailLower]);

  // --- helper to safely toggle busy state for an assignment id ---
  const setBusy = useCallback((id, v) => {
    setBusyIds(prev => {
      const ns = new Set(prev);
      if (v) ns.add(id); else ns.delete(id);
      return ns;
    });
  }, []);

  // --- load assignments once contractor resolved ---
  const loadAssignments = useCallback(async () => {
    if (!me?.id) return;

    // Build each query independently (no .clone())
    const qSelect = `id, status, report_id, assigned_at, response_at, reassignment_count,
      maintenance_reports (
        id, title, description, category, urgency, location, address, created_at, updated_at
      )`;

    const [pendingRes, activeRes, historyRes] = await Promise.all([
      supabase
        .from("helpdesk_assignments")
        .select(qSelect)
        .eq("contractor_id", me.id)
        .eq("status", "assigned")
        .order("assigned_at", { ascending: true }),

      supabase
        .from("helpdesk_assignments")
        .select(qSelect)
        .eq("contractor_id", me.id)
        .eq("status", "accepted")
        .order("response_at", { ascending: true }),

      supabase
        .from("helpdesk_assignments")
        .select(qSelect)
        .eq("contractor_id", me.id)
        .in("status", ["rejected", "completed"]) 
        .order("updated_at", { ascending: false })
    ]);

    if (!pendingRes.error) setPending(pendingRes.data ?? []);
    if (!activeRes.error) setActive(activeRes.data ?? []);
    if (!historyRes.error) setHistory(historyRes.data ?? []);
  }, [me?.id]);

  useEffect(() => {
    if (me?.id) loadAssignments();
  }, [me?.id, loadAssignments]);

  // --- actions ---
  const acceptAssignment = async (assignment) => {
    if (!assignment?.id || !me?.id) return;
    setBusy(assignment.id, true);
    try {
      const now = new Date().toISOString();
      const { error: upErr } = await supabase
        .from("helpdesk_assignments")
        .update({ status: "accepted", response_at: now, updated_at: now })
        .eq("id", assignment.id)
        .eq("contractor_id", me.id);
      if (upErr) throw upErr;

      const { error: respErr } = await supabase.from("contractor_responses").insert({
        assignment_id: assignment.id,
        contractor_id: me.id,
        response: "accepted",
        notes: null,
      });
      if (respErr) throw respErr;

      await loadAssignments();
    } catch (e) {
      console.error(e);
      alert("Failed to accept assignment. Please try again.");
    } finally {
      setBusy(assignment.id, false);
    }
  };

  const rejectAssignment = async (assignment) => {
    if (!assignment?.id || !me?.id) return;
    const notes = window.prompt("Please add a short note for the rejection (optional):", "");
    setBusy(assignment.id, true);
    try {
      const now = new Date().toISOString();
      const { error: upErr } = await supabase
        .from("helpdesk_assignments")
        .update({ status: "rejected", response_at: now, updated_at: now })
        .eq("id", assignment.id)
        .eq("contractor_id", me.id);
      if (upErr) throw upErr;

      const { error: respErr } = await supabase.from("contractor_responses").insert({
        assignment_id: assignment.id,
        contractor_id: me.id,
        response: "rejected",
        notes: notes || null,
      });
      if (respErr) throw respErr;

      await loadAssignments();
    } catch (e) {
      console.error(e);
      alert("Failed to reject assignment. Please try again.");
    } finally {
      setBusy(assignment.id, false);
    }
  };

  const openFinalReport = (assignment) => {
    setFinalReportOpenFor(assignment?.id ?? null);
    setFinalReportText("");
  };

  const submitFinalReport = async (assignmentId) => {
    if (!assignmentId || !me?.id) return;
    if (!finalReportText.trim()) {
      alert("Please enter a brief final report.");
      return;
    }
    setBusy(assignmentId, true);
    try {
      const { error: frErr } = await supabase
        .from("contractor_final_reports")
        .insert({
          assignment_id: assignmentId,
          contractor_id: me.id,
          report_text: finalReportText.trim(),
        });
      if (frErr) throw frErr;

      const now = new Date().toISOString();
      const { data: assignRow, error: updErr } = await supabase
        .from("helpdesk_assignments")
        .update({ status: "completed", updated_at: now })
        .eq("id", assignmentId)
        .select("report_id")
        .single();
      if (updErr) throw updErr;

      if (assignRow?.report_id) {
        await supabase
          .from("maintenance_reports")
          .update({ status: "completed", updated_at: now })
          .eq("id", assignRow.report_id);
      }

      setFinalReportOpenFor(null);
      setFinalReportText("");
      await loadAssignments();
    } catch (e) {
      console.error(e);
      alert("Failed to submit final report. Please try again.");
    } finally {
      setBusy(assignmentId, false);
    }
  };

  const refresh = () => { if (me?.id) loadAssignments(); };

  // --- UI helpers ---
  const Section = ({ title, children, count }) => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-white/90">{title}</h2>
        <span className="text-sm text-white/50">{count ?? 0}</span>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </div>
  );

  const Card = ({ a, actions }) => (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-sm">
      <div className="text-sm text-white/60 mb-1">#{a.id.slice(0, 8)}</div>
      <div className="font-medium text-white mb-2">{a.maintenance_reports?.title ?? "(No title)"}</div>
      <div className="text-sm text-white/70 space-y-1">
        <div><span className="text-white/50">Category:</span> {a.maintenance_reports?.category}</div>
        <div><span className="text-white/50">Urgency:</span> {a.maintenance_reports?.urgency}</div>
        <div><span className="text-white/50">Location:</span> {a.maintenance_reports?.address || a.maintenance_reports?.location || "—"}</div>
      </div>
      <div className="mt-4 flex gap-2 flex-wrap">{actions}</div>
    </div>
  );

  if (loading) return <div className="p-6 text-white/70">Loading your contractor dashboard…</div>;

  if (errorMsg) {
    return (
      <div className="p-6">
        <div className="text-red-300 bg-red-900/20 border border-red-800 rounded-xl p-4">{errorMsg}</div>
      </div>
    );
  }

  return (
    <div className="p-6 text-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Contractor Dashboard</h1>
        <button onClick={refresh} className="px-3 py-2 rounded-xl border border-white/10 hover:bg-white/10">Refresh</button>
      </div>

      {/* Pending (assigned, needs response) */}
      <Section title="Pending Assignments" count={pending.length}>
        {pending.length === 0 && <div className="text-white/50">No pending assignments.</div>}
        {pending.map((a) => (
          <Card
            key={a.id}
            a={a}
            actions={
              <>
                <button onClick={() => acceptAssignment(a)} disabled={busyIds.has(a.id)} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60">
                  {busyIds.has(a.id) ? "Accepting…" : "Accept"}
                </button>
                <button onClick={() => rejectAssignment(a)} disabled={busyIds.has(a.id)} className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-60">
                  {busyIds.has(a.id) ? "Rejecting…" : "Reject"}
                </button>
              </>
            }
          />
        ))}
      </Section>

      {/* Active (accepted) */}
      <Section title="Active Assignments" count={active.length}>
        {active.length === 0 && <div className="text-white/50">No active assignments.</div>}
        {active.map((a) => (
          <Card
            key={a.id}
            a={a}
            actions={
              <>
                <button onClick={() => openFinalReport(a)} disabled={busyIds.has(a.id)} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60">
                  Submit Final Report
                </button>
              </>
            }
          />
        ))}
      </Section>

      {/* History */}
      <Section title="History" count={history.length}>
        {history.length === 0 && <div className="text-white/50">No history yet.</div>}
        {history.map((a) => (
          <Card key={a.id} a={a} actions={<span className="text-white/50">{a.status}</span>} />
        ))}
      </Section>

      {/* Final Report Modal */}
      {finalReportOpenFor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-xl rounded-2xl bg-zinc-900 border border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Submit Final Report</h3>
              <button onClick={() => setFinalReportOpenFor(null)} className="px-2 py-1 text-white/70 hover:text-white">✕</button>
            </div>
            <textarea
              rows={6}
              value={finalReportText}
              onChange={(e) => setFinalReportText(e.target.value)}
              placeholder="Describe what you did, parts replaced, recommendations…"
              className="w-full rounded-xl bg-black/30 border border-white/10 p-3 outline-none"
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <button onClick={() => setFinalReportOpenFor(null)} className="px-3 py-2 rounded-xl border border-white/10 hover:bg-white/10">Cancel</button>
              <button onClick={() => submitFinalReport(finalReportOpenFor)} disabled={busyIds.has(finalReportOpenFor)} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60">
                {busyIds.has(finalReportOpenFor) ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

