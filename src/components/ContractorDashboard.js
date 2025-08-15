// src/components/ContractorDashboard.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import {
  RefreshCcw, CheckCircle2, XCircle, FilePlus2,
  Wrench, PackagePlus, Plus, Minus, ClipboardList,
  Image as ImageIcon, Video as VideoIcon
} from "lucide-react";

const BUCKET = "maintenance-files";

function uuid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  );
}
function classifyType(mime) {
  if (!mime) return "file";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}
function cents(n) {
  const v = Number(n || 0);
  return Math.round(v * 100) / 100;
}

export default function ContractorDashboard() {
  // 🔐 auth (stable: no redirect on transient nulls)
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // me = row from public.contractors
  const [me, setMe] = useState(null);

  // data
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(new Set());

  // modals
  const [detailsId, setDetailsId] = useState(null);
  const [finalFor, setFinalFor] = useState(null);

  // final-report state
  const [reportText, setReportText] = useState("");
  const [applianceName, setApplianceName] = useState("");
  const [applianceBrand, setApplianceBrand] = useState("");
  const [vatPct, setVatPct] = useState(0); // optional VAT for now
  const [parts, setParts] = useState([]);
  const [files, setFiles] = useState([]); // File[]

  // auth bootstrap
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (mounted) { setUser(user ?? null); setAuthReady(true); }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  const setBusyId = (id, v) =>
    setBusy(prev => { const s = new Set(prev); v ? s.add(id) : s.delete(id); return s; });

  // fetch contractor + his assignments (with report, property, and tenant attachments)
  const loadData = useCallback(async () => {
    if (!user?.email) return;
    setRefreshing(true);
    try {
      const { data: contractor, error: cErr } = await supabase
        .from("contractors").select("*")
        .ilike("email", user.email) // case-insensitive exact match
        .single();
      if (cErr || !contractor) throw new Error("No contractor profile found for this account.");
      setMe(contractor);

      const { data: rows, error: aErr } = await supabase
        .from("helpdesk_assignments")
        .select(`
          id, status, assigned_at, response_at, updated_at, report_id, landlord_id, contractor_id,
          maintenance_reports:report_id (
            id, title, description, category, urgency, status, created_at, location, address, property_id,
            property:property_id ( id, name, address ),
            attachments (*)
          )
        `)
        .eq("contractor_id", contractor.id)
        .order("updated_at", { ascending: false });
      if (aErr) throw aErr;

      setAssignments(rows || []);
    } catch (e) {
      console.error("Load error:", e);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => { if (authReady) loadData(); }, [authReady, loadData]);

  const refresh = () => loadData();

  // bucket signed urls cache (for tenant attachments preview)
  const [signed, setSigned] = useState({});
  const getSigned = useCallback(async (path) => {
    if (!path) return null;
    if (signed[path]) return signed[path];
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error) { console.warn("sign error", error.message); return null; }
    setSigned(prev => ({ ...prev, [path]: data?.signedUrl || null }));
    return data?.signedUrl || null;
  }, [signed]);

  // status buckets
  const grouped = useMemo(() => {
    const g = { assigned: [], accepted: [], review: [], completed: [], rejected: [] };
    for (const a of assignments) {
      const st = a.status || "assigned";
      if (g[st]) g[st].push(a);
    }
    return g;
  }, [assignments]);

  /* ===== actions ===== */
  const accept = async (a) => {
    if (!a?.id || !me?.id || busy.has(a.id)) return;
    setBusyId(a.id, true);
    try {
      const now = new Date().toISOString();
      const { error: uErr } = await supabase
        .from("helpdesk_assignments")
        .update({ status: "accepted", response_at: now, updated_at: now })
        .eq("id", a.id)
        .eq("contractor_id", me.id);
      if (uErr) throw uErr;

      await supabase.from("contractor_responses").insert({
        assignment_id: a.id, contractor_id: me.id, response: "accepted", response_at: now
      });

      await loadData();
    } catch (e) {
      alert("Failed to accept: " + (e.message || "Please try again."));
    } finally { setBusyId(a.id, false); }
  };

  const reject = async (a) => {
    if (!a?.id || !me?.id || busy.has(a.id)) return;
    const notes = window.prompt("Reason for rejection (optional):", "");
    setBusyId(a.id, true);
    try {
      const now = new Date().toISOString();
      const { error: uErr } = await supabase
        .from("helpdesk_assignments")
        .update({ status: "rejected", response_at: now, updated_at: now })
        .eq("id", a.id)
        .eq("contractor_id", me.id);
      if (uErr) throw uErr;

      await supabase.from("contractor_responses").insert({
        assignment_id: a.id, contractor_id: me.id,
        response: "rejected", response_at: now, notes: notes || null
      });

      await loadData();
    } catch (e) {
      alert("Failed to reject: " + (e.message || "Please try again."));
    } finally { setBusyId(a.id, false); }
  };

  const openDetails = (id) => setDetailsId(id);
  const closeDetails = () => setDetailsId(null);

  // open final-report modal with fresh state
  const openFinal = (a) => {
    setFinalFor(a.id);
    setReportText("");
    setApplianceName("");
    setApplianceBrand("");
    setVatPct(0);
    setParts([{ id: uuid(), part_name: "", brand: "", qty: 1, unit_price: 0 }]);
    setFiles([]);
  };
  const closeFinal = () => setFinalFor(null);

  // parts editor
  const updatePart = (id, patch) => setParts(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  const addPart = () => setParts(prev => [...prev, { id: uuid(), part_name: "", brand: "", qty: 1, unit_price: 0 }]);
  const removePart = (id) => setParts(prev => prev.length > 1 ? prev.filter(p => p.id !== id) : prev);

  const subtotal = useMemo(() => {
    let s = 0;
    for (const p of parts) s += (Number(p.qty)||0) * (Number(p.unit_price)||0);
    return cents(s);
  }, [parts]);
  const total = useMemo(() => cents(subtotal * (1 + (Number(vatPct)||0)/100)), [subtotal, vatPct]);

  const onFilePick = (e) => {
    const chosen = Array.from(e.target.files || []);
    if (!chosen.length) return;
    setFiles(prev => [...prev, ...chosen]);
    e.target.value = "";
  };

  const uploadAttachment = async (assignmentId, finalReportId, file) => {
    const ext = file.name.split(".").pop();
    const path = `contractor/${assignmentId}/final/${uuid()}.${ext || "bin"}`;
    const { error: upErr } = await supabase.storage.from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (upErr) throw upErr;

    const { error: aErr } = await supabase.from("attachments").insert({
      report_id: null,
      contractor_final_report_id: finalReportId,
      file_name: file.name,
      file_path: path,
      file_type: classifyType(file.type),
      file_size: file.size
    });
    if (aErr) throw aErr;
  };

  const submitFinalReport = async (assignmentId) => {
    const a = assignments.find(x => x.id === assignmentId);
    if (!a || !me?.id || busy.has(assignmentId)) return;
    if (!reportText.trim()) { alert("Please add a short final report."); return; }

    setBusyId(assignmentId, true);
    try {
      // 1) header
      const { data: frIns, error: frErr } = await supabase
        .from("contractor_final_reports")
        .insert({
          assignment_id: assignmentId,
          contractor_id: me.id,
          report_text: reportText.trim(),
          appliance_name: applianceName || null,
          appliance_brand: applianceBrand || null,
          tax_rate: (Number(vatPct)||0) / 100,
          currency: "AED"
        })
        .select("id")
        .single();
      if (frErr) throw frErr;
      const finalReportId = frIns.id;

      // 2) parts (optional)
      const rows = parts
        .filter(p => (p.part_name?.trim()?.length || 0) > 0)
        .map(p => ({
          final_report_id: finalReportId,
          assignment_id: assignmentId,
          report_id: a.report_id,
          part_name: p.part_name.trim(),
          brand: p.brand?.trim() || null,
          qty: Number(p.qty) || 0,
          unit_price: Number(p.unit_price) || 0,
          currency: "AED"
        }));
      if (rows.length) {
        const { error: pErr } = await supabase.from("contractor_final_parts").insert(rows);
        if (pErr) throw pErr;
      }

      // 3) uploads (optional)
      for (const f of files) await uploadAttachment(assignmentId, finalReportId, f);

      // 4) set status -> review
      const now = new Date().toISOString();
      const { error: uErr } = await supabase
        .from("helpdesk_assignments")
        .update({ status: "review", updated_at: now })
        .eq("id", assignmentId)
        .eq("contractor_id", me.id);
      if (uErr) throw uErr;

      closeFinal();
      await loadData();
      alert("Final report submitted for review.");
    } catch (e) {
      console.error("Submit error:", e);
      alert("Failed to submit final report: " + (e.message || "Please try again."));
    } finally {
      setBusyId(assignmentId, false);
    }
  };

  /* ===== UI ===== */

  if (authReady && !user) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-900 text-white">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Session expired</h2>
        </div>
      </div>
    );
  }
  if (loading) {
    return <div className="min-h-screen grid place-items-center text-white">Loading…</div>;
  }

  const Section = ({ title, count, children }) => (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-white/90">{title}</h2>
        <span className="text-sm text-white/60">{count ?? 0}</span>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {children?.length ? children : (
          <div className="col-span-full text-white/60 text-sm border border-white/10 rounded-xl p-4">
            Nothing here yet.
          </div>
        )}
      </div>
    </section>
  );

  const AssignmentCard = ({ a, onDetails, onAccept, onReject, primaryActionLabel, onPrimaryAction, secondaryActionLabel, onSecondaryAction, busy }) => {
    const mr = a.maintenance_reports || {};
    const prop = mr.property || {};
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-white/50 mb-1">#{a.id.slice(0,8)}</div>
            <div className="text-lg font-semibold">{mr.title || mr.category || "Maintenance Request"}</div>
            <div className="text-sm text-white/70">{prop.name || "—"} • {prop.address || mr.address || "—"}</div>
            <div className="text-sm text-white/70">Unit: {mr.location || "—"} • Urgency: {mr.urgency || "—"}</div>
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10">{a.status}</span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button onClick={onDetails} className="text-sm px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/10">Details</button>
          {onAccept && <button disabled={busy} onClick={onAccept} className="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/>Accept</button>}
          {onReject && <button disabled={busy} onClick={onReject} className="text-sm px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white inline-flex items-center gap-1"><XCircle className="w-4 h-4" />Reject</button>}
          {onPrimaryAction && <button disabled={busy} onClick={onPrimaryAction} className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white inline-flex items-center gap-1"><FilePlus2 className="w-4 h-4" />{primaryActionLabel || "Primary"}</button>}
          {onSecondaryAction && <button disabled={busy} onClick={onSecondaryAction} className="text-sm px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/10">{secondaryActionLabel || "Secondary"}</button>}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 text-white">
      <div className="max-w-7xl mx-auto p-6">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Wrench className="w-7 h-7 text-emerald-400" />
            <h1 className="text-3xl font-bold">Contractor Dashboard</h1>
          </div>
          <button onClick={refresh} disabled={refreshing} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/20 hover:bg-white/10 ${refreshing ? "opacity-60 cursor-not-allowed" : ""}`}>
            <RefreshCcw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            <span className="text-sm">Refresh</span>
          </button>
        </header>

        {/* Sections */}
        <Section title="New Requests" count={grouped.assigned.length}>
          {grouped.assigned.map(a => (
            <AssignmentCard
              key={a.id}
              a={a}
              onDetails={() => setDetailsId(a.id)}
              onAccept={() => accept(a)}
              onReject={() => reject(a)}
              busy={busy.has(a.id)}
            />
          ))}
        </Section>

        <Section title="Active (Accepted)" count={grouped.accepted.length}>
          {grouped.accepted.map(a => (
            <AssignmentCard
              key={a.id}
              a={a}
              onDetails={() => setDetailsId(a.id)}
              primaryActionLabel="Submit Final Report"
              onPrimaryAction={() => openFinal(a)}
              secondaryActionLabel="Mark Not Possible"
              onSecondaryAction={() => reject(a)}
              busy={busy.has(a.id)}
            />
          ))}
        </Section>

        <Section title="In Review" count={grouped.review.length}>
          {grouped.review.map(a => (
            <AssignmentCard key={a.id} a={a} onDetails={() => setDetailsId(a.id)} />
          ))}
        </Section>

        <Section title="Completed" count={grouped.completed.length}>
          {grouped.completed.map(a => (
            <AssignmentCard key={a.id} a={a} onDetails={() => setDetailsId(a.id)} />
          ))}
        </Section>

        <Section title="Declined" count={grouped.rejected.length}>
          {grouped.rejected.map(a => (
            <AssignmentCard key={a.id} a={a} onDetails={() => setDetailsId(a.id)} />
          ))}
        </Section>
      </div>

      {/* Details Modal */}
      {detailsId && (
        <DetailsModal
          assignment={assignments.find(x => x.id === detailsId)}
          onClose={() => setDetailsId(null)}
          getSigned={getSigned}
        />
      )}

      {/* Final Report Modal */}
      {finalFor && (
        <FinalReportModal
          assignment={assignments.find(x => x.id === finalFor)}
          onClose={() => setFinalFor(null)}
          submitting={busy.has(finalFor)}
          reportText={reportText}
          setReportText={setReportText}
          applianceName={applianceName}
          setApplianceName={setApplianceName}
          applianceBrand={applianceBrand}
          setApplianceBrand={setApplianceBrand}
          vatPct={vatPct}
          setVatPct={setVatPct}
          parts={parts}
          updatePart={updatePart}
          addPart={addPart}
          removePart={removePart}
          subtotal={subtotal}
          total={total}
          files={files}
          onFilePick={onFilePick}
          onSubmit={() => submitFinalReport(finalFor)}
        />
      )}
    </div>
  );
}

/* ===== Subcomponents ===== */

function DetailsModal({ assignment, onClose, getSigned }) {
  const mr = assignment?.maintenance_reports || {};
  const prop = mr.property || {};
  const attachments = mr.attachments || [];
  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4">
      <div className="bg-white text-gray-900 rounded-2xl shadow-xl max-w-3xl w-full p-6 relative">
        <button className="absolute top-4 right-4 text-gray-500 hover:text-black" onClick={onClose}>✕</button>
        <div className="flex items-center gap-2 mb-2">
          <ClipboardList className="w-5 h-5 text-blue-600" />
          <h3 className="text-2xl font-bold">{mr.title || mr.category || "Maintenance Request"}</h3>
        </div>
        <div className="text-sm text-gray-600 mb-1">{prop.name || "—"} • {prop.address || mr.address || "—"}</div>
        <div className="text-sm text-gray-600 mb-3">Unit: {mr.location || "—"} • Urgency: {mr.urgency || "—"}</div>
        <p className="text-gray-800 whitespace-pre-wrap mb-4">{mr.description}</p>

        {attachments?.length > 0 && (
          <>
            <div className="font-semibold mb-1">Tenant Attachments</div>
            <div className="grid grid-cols-3 gap-3">
              {attachments.map(att => (
                <AttachmentThumb key={att.id} att={att} getSigned={getSigned} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function AttachmentThumb({ att, getSigned }) {
  const [url, setUrl] = useState(null);
  useEffect(() => { (async () => setUrl(await getSigned(att.file_path)))(); }, [att, getSigned]);
  const type = att.file_type || "file";
  if (!url) return <div className="aspect-video rounded-lg bg-gray-200" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <div className="aspect-video rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
        {type === "image" ? <img src={url} alt={att.file_name} className="w-full h-full object-cover" /> :
         type === "video" ? <video src={url} controls className="w-full h-full object-cover" /> :
         <div className="p-6 text-gray-600 text-sm">{att.file_name}</div>}
      </div>
      <div className="mt-1 text-xs text-gray-600 truncate">{att.file_name}</div>
    </a>
  );
}

function FinalReportModal({
  assignment, onClose, submitting,
  reportText, setReportText,
  applianceName, setApplianceName,
  applianceBrand, setApplianceBrand,
  vatPct, setVatPct,
  parts, updatePart, addPart, removePart,
  subtotal, total,
  files, onFilePick,
  onSubmit
}) {
  const a = assignment || {};
  const mr = a.maintenance_reports || {};
  const prop = mr.property || {};
  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4">
      <div className="bg-white text-gray-900 rounded-2xl shadow-xl max-w-3xl w-full p-6 relative">
        <button className="absolute top-4 right-4 text-gray-500 hover:text-black" onClick={onClose}>✕</button>
        <h3 className="text-2xl font-bold mb-1">Submit Final Report</h3>
        <div className="text-sm text-gray-600 mb-4">
          {prop.name || "—"} • {prop.address || mr.address || "—"} — Unit {mr.location || "—"}
        </div>

        <label className="block text-sm font-medium mb-1">Work Summary</label>
        <textarea
          className="w-full border rounded-lg p-2 mb-3"
          rows={4}
          placeholder="Describe what you did / findings…"
          value={reportText}
          onChange={e => setReportText(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Appliance</label>
            <input className="w-full border rounded-lg p-2" placeholder="e.g., Split AC" value={applianceName} onChange={e => setApplianceName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Brand / Company</label>
            <input className="w-full border rounded-lg p-2" placeholder="e.g., Daikin" value={applianceBrand} onChange={e => setApplianceBrand(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold flex items-center gap-2"><PackagePlus className="w-4 h-4" /> Parts Used</div>
          <button onClick={addPart} className="text-sm inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"><Plus className="w-4 h-4" />Add</button>
        </div>

        <div className="mb-3">
          <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-600 mb-1">
            <div className="col-span-5">Part name</div>
            <div className="col-span-3">Brand</div>
            <div className="col-span-2">Qty</div>
            <div className="col-span-2">Unit price (AED)</div>
          </div>
          {parts.map(row => (
            <div key={row.id} className="grid grid-cols-12 gap-2 mb-2">
              <input className="col-span-5 border rounded-lg p-2 text-sm" placeholder="e.g., Capacitor 35µF" value={row.part_name} onChange={e => updatePart(row.id, { part_name: e.target.value })} />
              <input className="col-span-3 border rounded-lg p-2 text-sm" placeholder="e.g., Epcos" value={row.brand || ""} onChange={e => updatePart(row.id, { brand: e.target.value })} />
              <input type="number" min="0" step="0.1" className="col-span-2 border rounded-lg p-2 text-sm" value={row.qty} onChange={e => updatePart(row.id, { qty: e.target.value })} />
              <div className="col-span-2 flex items-center gap-2">
                <input type="number" min="0" step="0.01" className="w-full border rounded-lg p-2 text-sm" value={row.unit_price} onChange={e => updatePart(row.id, { unit_price: e.target.value })} />
                <button onClick={() => removePart(row.id)} className="px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"><Minus className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 items-end mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">VAT % (optional)</label>
            <input type="number" min="0" step="0.01" className="w-full border rounded-lg p-2" placeholder="0 or 5" value={vatPct} onChange={e => setVatPct(e.target.value)} />
          </div>
          <div className="text-sm">
            <div className="text-gray-600">Subtotal</div>
            <div className="text-lg font-semibold">AED {subtotal.toFixed(2)}</div>
          </div>
          <div className="text-sm">
            <div className="text-gray-600">Total</div>
            <div className="text-lg font-semibold">AED {total.toFixed(2)}</div>
          </div>
        </div>

        <div className="mb-4">
          <div className="font-semibold mb-1 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> <VideoIcon className="w-4 h-4" /> Evidence (photos/videos)</div>
          <input type="file" multiple accept="image/*,video/*" onChange={onFilePick} className="block w-full text-sm text-gray-700" />
          {!!files.length && <div className="mt-2 text-xs text-gray-600">{files.length} file(s) selected</div>}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button disabled={submitting} onClick={onSubmit} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60">
            {submitting ? "Submitting…" : "Submit Final Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
