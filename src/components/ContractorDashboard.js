// src/components/ContractorDashboard.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../supabase";

// Your private bucket
const ATTACHMENTS_BUCKET = "maintenance-files";

/* -------------------- utils -------------------- */
function uid() {
  return (globalThis.crypto?.randomUUID?.() ??
    `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
}

// Try to parse bucket & path from stored file_path; fallback to default bucket + raw path
function parseBucketAndPath(filePath) {
  try {
    const u = new URL(filePath);
    const segs = u.pathname.split("/").filter(Boolean);
    const idx = segs.findIndex(s => s === "object");
    if (idx >= 0 && segs.length >= idx + 3) {
      const bucket = segs[idx + 2];
      const obj = segs.slice(idx + 3).join("/");
      if (bucket && obj) return { bucket, path: obj };
    }
  } catch (_) {}
  return { bucket: ATTACHMENTS_BUCKET, path: String(filePath).replace(/^\/+/, "") };
}

async function signUrl(filePath, expiresIn = 3600) {
  const { bucket, path } = parseBucketAndPath(filePath);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  return error ? filePath : (data?.signedUrl || filePath);
}

/* -------------------- visual helpers -------------------- */
const STATUS_STYLES = {
  assigned: { bg: "bg-blue-500", text: "Assigned" },
  accepted: { bg: "bg-emerald-500", text: "Accepted" },
  review:   { bg: "bg-purple-600", text: "Review" },
  rejected: { bg: "bg-rose-500", text: "Rejected" },
  completed:{ bg: "bg-gray-500", text: "Completed" },
};

function StatusRibbon({ status }) {
  const s = STATUS_STYLES[status] || { bg: "bg-slate-500", text: status || "—" };
  return (
    <div className={`absolute -right-1 top-3 rotate-1`}>
      <span className={`inline-block ${s.bg} text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow`}>
        {s.text}
      </span>
    </div>
  );
}

/* -------------------- component -------------------- */
export default function ContractorDashboard() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Lists
  const [pending, setPending] = useState([]);    // status = 'assigned'
  const [active, setActive] = useState([]);      // status = 'accepted'
  const [submitted, setSubmitted] = useState([]);// status = 'review'
  const [history, setHistory] = useState([]);    // status in ('rejected','completed')

  // Details modal
  const [detailsOpenFor, setDetailsOpenFor] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [tenantAttachments, setTenantAttachments] = useState([]);
  const [tenantSignedUrls, setTenantSignedUrls] = useState({});
  const [latestFinalReport, setLatestFinalReport] = useState(null);
  const [finalEvidence, setFinalEvidence] = useState([]);
  const [finalEvidenceUrls, setFinalEvidenceUrls] = useState({});

  // Compose modal
  const [composeOpenFor, setComposeOpenFor] = useState(null); // assignment id
  const [finalReportText, setFinalReportText] = useState("");
  const [finalFiles, setFinalFiles] = useState([]); // [{id,file,name,size,status}]
  const [submitting, setSubmitting] = useState(false);

  // Guards
  const [busyIds, setBusyIds] = useState(new Set());
  const setBusy = useCallback((id, v) => {
    setBusyIds(prev => {
      const ns = new Set(prev);
      if (v) ns.add(id); else ns.delete(id);
      return ns;
    });
  }, []);

  const emailLower = useMemo(() => session?.user?.email?.toLowerCase() ?? null, [session]);

  /* ----- bootstrap session ----- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) setSession(data.session);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => { mounted = false; sub?.subscription?.unsubscribe?.(); };
  }, []);

  /* ----- resolve contractor row ----- */
  useEffect(() => {
    if (!emailLower) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorMsg("");
      const { data, error } = await supabase
        .from("contractors")
        .select("id, full_name, email, phone, services_provided")
        .eq("email", emailLower)
        .single();

      if (cancelled) return;

      if (error || !data) {
        setMe(null);
        setErrorMsg("No matching contractor record found for this account. Contact admin.");
      } else {
        setMe(data);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [emailLower]);

  /* ----- load assignments ----- */
  const loadAssignments = useCallback(async () => {
    if (!me?.id) return;

    const sel = `id, status, report_id, assigned_at, response_at, reassignment_count, updated_at,
      maintenance_reports:report_id (
        id, title, description, category, urgency, location, address, created_at, updated_at, property_id,
        property:property_id ( id, name, address )
      )`;

    const [resAssigned, resAccepted, resReview, resHist] = await Promise.all([
      supabase
        .from("helpdesk_assignments")
        .select(sel)
        .eq("contractor_id", me.id)
        .eq("status", "assigned")
        .order("assigned_at", { ascending: true }),

      supabase
        .from("helpdesk_assignments")
        .select(sel)
        .eq("contractor_id", me.id)
        .eq("status", "accepted")
        .order("response_at", { ascending: true }),

      supabase
        .from("helpdesk_assignments")
        .select(sel)
        .eq("contractor_id", me.id)
        .eq("status", "review")
        .order("updated_at", { ascending: false }),

      supabase
        .from("helpdesk_assignments")
        .select(sel)
        .eq("contractor_id", me.id)
        .in("status", ["rejected", "completed"])
        .order("updated_at", { ascending: false }),
    ]);

    if (!resAssigned.error) setPending(resAssigned.data ?? []);
    if (!resAccepted.error) setActive(resAccepted.data ?? []);
    if (!resReview.error) setSubmitted(resReview.data ?? []);
    if (!resHist.error) setHistory(resHist.data ?? []);
  }, [me?.id]);

  useEffect(() => { if (me?.id) loadAssignments(); }, [me?.id, loadAssignments]);

  /* ----- actions ----- */
  const acceptAssignment = async (assignment) => {
    if (!assignment?.id || !me?.id) return;
    if (busyIds.has(assignment.id)) return;
    setBusy(assignment.id, true);
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("helpdesk_assignments")
        .update({ status: "accepted", response_at: now, updated_at: now })
        .eq("id", assignment.id)
        .eq("contractor_id", me.id)
        .eq("status", "assigned")
        .select("id")
        .single();
      if (error || !data?.id) throw new Error(error?.message || "0 rows updated.");

      // record response
      const { error: respErr } = await supabase.from("contractor_responses").insert({
        assignment_id: assignment.id,
        contractor_id: me.id,
        response: "accepted",
        notes: null,
      }, { returning: "minimal" });
      if (respErr) throw respErr;

      await loadAssignments();
    } catch (e) {
      console.error("Accept failed:", e);
      alert(`Failed to accept assignment: ${e.message || "Please try again."}`);
    } finally {
      setBusy(assignment.id, false);
    }
  };

  const rejectAssignment = async (assignment) => {
    if (!assignment?.id || !me?.id) return;
    if (busyIds.has(assignment.id)) return;
    const notes = window.prompt("Please add a short note for the rejection (optional):", "");
    setBusy(assignment.id, true);
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("helpdesk_assignments")
        .update({ status: "rejected", response_at: now, updated_at: now })
        .eq("id", assignment.id)
        .eq("contractor_id", me.id)
        .eq("status", "assigned")
        .select("id")
        .single();
      if (error || !data?.id) throw new Error(error?.message || "0 rows updated.");

      const { error: respErr } = await supabase.from("contractor_responses").insert({
        assignment_id: assignment.id,
        contractor_id: me.id,
        response: "rejected",
        notes: notes || null,
      }, { returning: "minimal" });
      if (respErr) throw respErr;

      await loadAssignments();
    } catch (e) {
      console.error("Reject failed:", e);
      alert(`Failed to reject assignment: ${e.message || "Please try again."}`);
    } finally {
      setBusy(assignment.id, false);
    }
  };

  /* ----- details modal ----- */
  const openDetails = async (assignment) => {
    if (!assignment) return;
    setDetailsOpenFor(assignment);
    setDetailsLoading(true);
    setTenantAttachments([]); setTenantSignedUrls({});
    setLatestFinalReport(null); setFinalEvidence([]); setFinalEvidenceUrls({});
    try {
      const [{ data: atts, error: attErr }, { data: frs }] = await Promise.all([
        supabase
          .from("attachments")
          .select("id, file_name, file_type, file_size, file_path, created_at")
          .eq("report_id", assignment.report_id)
          .order("created_at", { ascending: true }),
        supabase
          .from("contractor_final_reports")
          .select("id, contractor_id, report_text, created_at")
          .eq("assignment_id", assignment.id)
          .order("created_at", { ascending: false })
          .limit(1)
      ]);
      if (attErr) throw attErr;

      setTenantAttachments(atts || []);
      const urlMap = {};
      for (const a of atts || []) urlMap[a.id] = await signUrl(a.file_path);
      setTenantSignedUrls(urlMap);

      const fr = (frs && frs[0]) || null;
      setLatestFinalReport(fr);

      if (fr?.id) {
        const { data: ev } = await supabase
          .from("attachments")
          .select("id, file_name, file_type, file_size, file_path, created_at")
          .eq("contractor_final_report_id", fr.id)
          .order("created_at", { ascending: true });
        setFinalEvidence(ev || []);
        const evMap = {};
        for (const a of ev || []) evMap[a.id] = await signUrl(a.file_path);
        setFinalEvidenceUrls(evMap);
      }
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to load details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setDetailsOpenFor(null);
    setTenantAttachments([]); setTenantSignedUrls({});
    setLatestFinalReport(null); setFinalEvidence([]); setFinalEvidenceUrls({});
  };

  /* ----- compose modal (final report submit) ----- */
  const openFinalReport = (assignment) => {
    setComposeOpenFor(assignment?.id ?? null);
    setFinalReportText("");
    setFinalFiles([]);
  };

  const onPickFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setFinalFiles(prev => [
      ...prev,
      ...files.map(f => ({
        id: uid(),
        file: f,
        name: f.name,
        size: f.size,
        status: "queued"
      }))
    ]);
    e.target.value = "";
  };

  const removePickedFile = (id) => {
    setFinalFiles(prev => prev.filter(f => f.id !== id));
  };

  const submitFinalReport = async (assignmentId) => {
    if (!assignmentId || !me?.id) return;
    if (busyIds.has(assignmentId) || submitting) return;
    if (!finalReportText.trim()) {
      alert("Please enter a brief final report.");
      return;
    }
    setBusy(assignmentId, true);
    setSubmitting(true);
    try {
      // 1) Insert final report
      const structured = finalReportText.trim();
      const { data: frIns, error: frErr } = await supabase
        .from("contractor_final_reports")
        .insert({
          assignment_id: assignmentId,
          contractor_id: me.id,
          report_text: structured
        })
        .select("id")
        .single();
      if (frErr) throw frErr;
      const finalReportId = frIns.id;

      // 2) Upload files & insert attachments rows
      for (const f of finalFiles) {
        setFinalFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: "uploading" } : x));
        const safeName = f.name.replace(/[^\w.\-]+/g, "_");
        const objectPath = `final_reports/${assignmentId}/${uid()}_${safeName}`;

        const { error: upErr } = await supabase.storage
          .from(ATTACHMENTS_BUCKET)
          .upload(objectPath, f.file, {
            cacheControl: "3600",
            contentType: f.file.type || undefined,
            upsert: false
          });
        if (upErr) { setFinalFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: "error" } : x)); throw upErr; }

        const { error: attErr } = await supabase
          .from("attachments")
          .insert({
            contractor_final_report_id: finalReportId,
            file_name: f.name,
            file_path: objectPath, // store path; sign later on view
            file_type: f.file.type || "application/octet-stream",
            file_size: f.size,
            duration: null
          }, { returning: "minimal" });
        if (attErr) { setFinalFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: "error" } : x)); throw attErr; }

        setFinalFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: "done" } : x));
      }

      // 3) Move assignment to REVIEW
      const now = new Date().toISOString();
      const { error: updErr } = await supabase
        .from("helpdesk_assignments")
        .update({ status: "review", review_submitted_at: now, updated_at: now })
        .eq("id", assignmentId);
      if (updErr) throw updErr;

      // 4) Reset modal & refresh
      setComposeOpenFor(null);
      setFinalReportText("");
      setFinalFiles([]);
      await loadAssignments();
    } catch (e) {
      console.error("Final report failed:", e);
      alert(`Failed to submit final report: ${e.message || "Please try again."}`);
    } finally {
      setSubmitting(false);
      setBusy(assignmentId, false);
    }
  };

  const refresh = () => { if (me?.id) loadAssignments(); };

  /* ----- UI helpers ----- */
  const Section = ({ title, children, count }) => (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-white/90">{title}</h2>
        <span className="text-sm text-white/60">{count ?? 0}</span>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </div>
  );

  const Card = ({ a, actions }) => {
    const mr = a.maintenance_reports || {};
    const propName = mr?.property?.name;
    const fullAddress = mr?.property?.address || mr?.address || mr?.location || "—";
    return (
      <div className="relative rounded-2xl border border-white/20 bg-white/15 backdrop-blur-sm p-4 shadow-sm">
        <StatusRibbon status={a.status} />
        <div className="text-xs text-white/70 mb-1">#{a.id.slice(0, 8)}</div>
        <div className="font-medium text-white mb-2">{mr?.title ?? "(No title)"}</div>
        <div className="text-sm text-white/80 space-y-1">
          {propName && <div><span className="text-white/60">Property:</span> {propName}</div>}
          <div><span className="text-white/60">Address:</span> {fullAddress}</div>
          <div><span className="text-white/60">Unit:</span> {mr?.location || "—"}</div>
          <div><span className="text-white/60">Category:</span> {mr?.category}</div>
          <div><span className="text-white/60">Urgency:</span> {mr?.urgency}</div>
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">{actions}</div>
      </div>
    );
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="mx-auto w-full max-w-7xl p-6 text-white/80">Loading your contractor dashboard…</div>
    </div>
  );

  if (errorMsg) return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="mx-auto w-full max-w-7xl p-6">
        <div className="text-red-100 bg-red-900/30 border border-red-800/60 rounded-xl p-4">{errorMsg}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-850 to-slate-800 text-white">
      <div className="mx-auto w-full max-w-7xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Contractor Dashboard</h1>
          <button onClick={refresh} className="px-3 py-2 rounded-xl border border-white/20 hover:bg-white/15">
            Refresh
          </button>
        </div>

        {/* Pending (assigned) */}
        <Section title="Pending Assignments" count={pending.length}>
          {pending.length === 0 && <div className="text-white/70">No pending assignments.</div>}
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
                  <button onClick={() => openDetails(a)} className="px-3 py-2 rounded-lg border border-white/20 hover:bg-white/15">
                    View Details
                  </button>
                </>
              }
            />
          ))}
        </Section>

        {/* Active (accepted) */}
        <Section title="Active Assignments" count={active.length}>
          {active.length === 0 && <div className="text-white/70">No active assignments.</div>}
          {active.map((a) => (
            <Card
              key={a.id}
              a={a}
              actions={
                <>
                  <button onClick={() => openDetails(a)} className="px-3 py-2 rounded-lg border border-white/20 hover:bg-white/15">
                    View Details
                  </button>
                  <button onClick={() => openFinalReport(a)} disabled={busyIds.has(a.id)} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60">
                    Submit Final Report
                  </button>
                </>
              }
            />
          ))}
        </Section>

        {/* Submitted for Review */}
        <Section title="Submitted for Review" count={submitted.length}>
          {submitted.length === 0 && <div className="text-white/70">Nothing awaiting review.</div>}
          {submitted.map((a) => (
            <Card
              key={a.id}
              a={a}
              actions={
                <>
                  <span className="px-3 py-2 rounded-lg bg-purple-700/80">Sent for review</span>
                  <button onClick={() => openDetails(a)} className="px-3 py-2 rounded-lg border border-white/20 hover:bg-white/15">
                    View Details
                  </button>
                </>
              }
            />
          ))}
        </Section>

        {/* History */}
        <Section title="History" count={history.length}>
          {history.length === 0 && <div className="text-white/70">No history yet.</div>}
          {history.map((a) => (
            <Card key={a.id} a={a} actions={
              <button onClick={() => openDetails(a)} className="px-3 py-2 rounded-lg border border-white/20 hover:bg-white/15">
                View Details
              </button>
            } />
          ))}
        </Section>

        {/* DETAILS MODAL */}
        {detailsOpenFor && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-5xl rounded-2xl bg-zinc-800 border border-white/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Assignment details</h3>
                <button onClick={closeDetails} className="px-2 py-1 text-white/80 hover:text-white">✕</button>
              </div>

              {detailsLoading ? (
                <div className="py-10 text-center text-white/80">Loading…</div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left: tenant report + attachments */}
                  <div className="rounded-xl border border-white/20 p-4 bg-white/5">
                    <h4 className="font-semibold mb-2">Tenant report</h4>
                    <div className="text-sm text-white/85 space-y-1 mb-3">
                      <div><span className="text-white/70">Title:</span> {detailsOpenFor?.maintenance_reports?.title || "—"}</div>
                      <div><span className="text-white/70">Category:</span> {detailsOpenFor?.maintenance_reports?.category || "—"}</div>
                      <div><span className="text-white/70">Urgency:</span> {detailsOpenFor?.maintenance_reports?.urgency || "—"}</div>
                      <div><span className="text-white/70">Property:</span> {detailsOpenFor?.maintenance_reports?.property?.name || "—"}</div>
                      <div><span className="text-white/70">Address:</span> {detailsOpenFor?.maintenance_reports?.property?.address || detailsOpenFor?.maintenance_reports?.address }</div>
                      <div><span className="text-white/70">Unit:</span> {detailsOpenFor?.maintenance_reports?.location || "—"}
</div>
                    </div>
                    <p className="text-sm text-white whitespace-pre-wrap mb-4">
                      {detailsOpenFor?.maintenance_reports?.description || "—"}
                    </p>

                    <h5 className="text-sm font-medium text-white/90 mb-2">Attachments from tenant</h5>
                    {tenantAttachments.length === 0 ? (
                      <div className="text-sm text-white/70">No attachments.</div>
                    ) : (
                      <ul className="space-y-2">
                        {tenantAttachments.map(a => (
                          <li key={a.id} className="text-sm">
                            <a className="text-blue-300 hover:underline break-all" href={tenantSignedUrls[a.id]} target="_blank" rel="noreferrer">
                              {a.file_name}
                            </a>
                            <span className="text-white/60"> — {a.file_type} · {(a.file_size ?? 0)} bytes</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Right: latest contractor final report (if any) */}
                  <div className="rounded-xl border border-white/20 p-4 bg-white/5">
                    <h4 className="font-semibold mb-2">Latest final report</h4>
                    {latestFinalReport ? (
                      <>
                        <div className="text-sm text-white/85 mb-2">Submitted: {new Date(latestFinalReport.created_at).toLocaleString()}</div>
                        <p className="text-sm text-white whitespace-pre-wrap mb-4">{latestFinalReport.report_text}</p>
                        <h5 className="text-sm font-medium text-white/90 mb-2">Evidence</h5>
                        {finalEvidence.length ? (
                          <ul className="space-y-2">
                            {finalEvidence.map(a => (
                              <li key={a.id} className="text-sm">
                                <a className="text-blue-300 hover:underline break-all" href={finalEvidenceUrls[a.id]} target="_blank" rel="noreferrer">
                                  {a.file_name}
                                </a>
                                <span className="text-white/60"> — {a.file_type} · {(a.file_size ?? 0)} bytes</span>
                              </li>
                            ))}
                          </ul>
                        ) : <div className="text-sm text-white/70">No files.</div>}
                      </>
                    ) : (
                      <div className="text-sm text-white/70">Not submitted yet.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* COMPOSE MODAL */}
        {composeOpenFor && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-2xl rounded-2xl bg-zinc-800 border border-white/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Submit Final Report</h3>
                <button onClick={() => setComposeOpenFor(null)} className="px-2 py-1 text-white/80 hover:text-white">✕</button>
              </div>

              <label className="block text-sm text-white/90 mb-2">Final report</label>
              <textarea
                rows={6}
                value={finalReportText}
                onChange={(e) => setFinalReportText(e.target.value)}
                placeholder="Describe what you did, parts replaced, recommendations…"
                className="w-full rounded-xl bg-white/10 border border-white/20 p-3 outline-none mb-4 text-white placeholder:text-white/70"
              />

              <div className="mb-3">
                <label className="block text-sm text-white/90 mb-2">Add photos/videos/PDF (optional)</label>
                <input
                  type="file"
                  multiple
                  onChange={onPickFiles}
                  className="block w-full text-sm text-white/90 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-white/15 file:text-white hover:file:bg-white/25"
                />
                {finalFiles.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {finalFiles.map(f => (
                      <li key={f.id} className="flex items-center justify-between text-sm">
                        <div className="truncate mr-3">{f.name} <span className="text-white/60">({f.size} bytes)</span></div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs rounded px-2 py-0.5 ${
                            f.status === "queued" ? "bg-slate-600" :
                            f.status === "uploading" ? "bg-blue-600" :
                            f.status === "done" ? "bg-emerald-600" : "bg-rose-600"
                          }`}>{f.status}</span>
                          {f.status !== "uploading" && (
                            <button onClick={() => removePickedFile(f.id)} className="px-2 py-1 rounded border border-white/20 hover:bg-white/15">Remove</button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setComposeOpenFor(null)} className="px-3 py-2 rounded-xl border border-white/20 hover:bg-white/15">Cancel</button>
                <button onClick={() => submitFinalReport(composeOpenFor)} disabled={submitting} className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60">
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

