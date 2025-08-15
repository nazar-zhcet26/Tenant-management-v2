// src/components/HelpdeskDashboard.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import {
  RefreshCcw, Building2, Info, UserPlus, CheckCircle2, Undo2,
  ClipboardList, FileText, FileUp, Eye, Mail, Phone, ShieldAlert, Tag
} from "lucide-react";

/** ====== CONFIG ====== */
const ATTACHMENTS_BUCKET = "maintenance-files"; // private bucket

/** ====== UTILS ====== */
const cn = (...xs) => xs.filter(Boolean).join(" ");
const fmtDate = (s) => { try { return new Date(s).toLocaleString(); } catch { return s || "—"; } };
async function loadJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
    s.onload = res; s.onerror = () => rej(new Error("Failed to load jsPDF"));
    document.head.appendChild(s);
  });
  return window.jspdf.jsPDF;
}

/** Status colors (badge + subtle ring accent) */
const STATUS = {
  pending:   { badge: "bg-amber-500/15 text-amber-300 border border-amber-500/30", ring: "ring-amber-500/20" },
  assigned:  { badge: "bg-sky-500/15 text-sky-300 border border-sky-500/30",       ring: "ring-sky-500/20" },
  accepted:  { badge: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30", ring: "ring-emerald-500/20" },
  review:    { badge: "bg-violet-500/15 text-violet-300 border border-violet-500/30",     ring: "ring-violet-500/20" },
  completed: { badge: "bg-teal-500/15 text-teal-300 border border-teal-500/30",           ring: "ring-teal-500/20" },
  rejected:  { badge: "bg-rose-500/15 text-rose-300 border border-rose-500/30",           ring: "ring-rose-500/20" },
};

/** ====== LIGHTER THEME TWEAKS ====== */
const PAGE_BG = "bg-gradient-to-b from-[#131c35] via-[#101a33] to-[#0b1220]";
const PANEL_BG = "bg-white/[0.06]";
const PANEL_BORDER = "border-white/15";
const INPUT_BG = "bg-white/[0.07]";
const INPUT_BORDER = "border-white/15";

export default function HelpdeskDashboard() {
  // auth
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // data
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [q, setQ] = useState("");

  // modals
  const [detailsFor, setDetailsFor] = useState(null);
  const [assignFor, setAssignFor] = useState(null);

  // contractors list for modal
  const [contractors, setContractors] = useState([]);
  const [rejectedBy, setRejectedBy] = useState(new Set());

  // signed urls cache
  const [signed, setSigned] = useState({});

  /* auth bootstrap */
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (mounted) { setUser(user ?? null); setAuthReady(true); }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  /* load */
  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("helpdesk_assignments")
        .select(`
          id, status, assigned_at, response_at, updated_at, reassignment_count,
          report_id, landlord_id, contractor_id,
          contractor:contractor_id ( id, full_name, email, phone, services_provided ),
          maintenance_reports:report_id (
            id, title, description, category, urgency, status, created_at, location, address, property_id,
            property:property_id ( id, name, address ),
            attachments (*)
          )
        `)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setAssignments(data || []);
    } catch (e) {
      console.error("Load error:", e);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (authReady) loadData(); }, [authReady, loadData]);

  /* signed url helper */
  const getSigned = useCallback(async (path) => {
    if (!path) return null;
    if (signed[path]) return signed[path];
    const { data, error } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(path, 3600);
    if (error) { console.warn("sign error", error.message); return null; }
    setSigned(prev => ({ ...prev, [path]: data?.signedUrl || null }));
    return data?.signedUrl || null;
  }, [signed]);

  /* filters */
  const propertyOptions = useMemo(() => {
    const set = new Map();
    assignments.forEach(a => {
      const name = a.maintenance_reports?.property?.name || "—";
      if (!set.has(name)) set.set(name, true);
    });
    return ["all", ...Array.from(set.keys())];
  }, [assignments]);

  const filtered = useMemo(() => {
    return (assignments || []).filter(a => {
      const mr = a.maintenance_reports || {};
      const propName = mr.property?.name || "—";
      const statusOk = (statusFilter === "all") ? true : (a.status === statusFilter);
      const propOk = (propertyFilter === "all") ? true : (propName === propertyFilter);
      const qOk = q.trim()
        ? ((mr.title || "").toLowerCase().includes(q.toLowerCase()) ||
           (mr.description || "").toLowerCase().includes(q.toLowerCase()))
        : true;
      return statusOk && propOk && qOk;
    });
  }, [assignments, statusFilter, propertyFilter, q]);

  const refresh = () => loadData();

  /* actions */
  const markCompleted = async (a) => {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("helpdesk_assignments")
        .update({ status: "completed", updated_at: now })
        .eq("id", a.id);
      if (error) throw error;
      await loadData();
    } catch (e) {
      alert("Failed to mark completed: " + (e.message || "Please try again."));
    }
  };

  const reopenToPending = async (a) => {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("helpdesk_assignments")
        .update({
          status: "pending",
          contractor_id: null,
          assigned_at: null,
          response_at: null,
          updated_at: now
        })
        .eq("id", a.id);
      if (error) throw error;
      await loadData();
    } catch (e) {
      alert("Failed to reopen: " + (e.message || "Please try again."));
    }
  };

  const openAssign = async (a) => {
    setAssignFor(a);
    const [ctr, rej] = await Promise.all([
      supabase.from("contractors").select("id, full_name, email, phone, services_provided").order("full_name", { ascending: true }),
      supabase.from("contractor_responses").select("contractor_id").eq("assignment_id", a.id).eq("response", "rejected")
    ]);
    setContractors(ctr.data || []);
    setRejectedBy(new Set((rej.data || []).map(r => r.contractor_id)));
  };

  const doAssign = async (assignment, contractorId) => {
    if (!assignment?.id || !contractorId) return;
    try {
      const prevId = assignment.contractor_id;
      const change = !!(prevId && prevId !== contractorId);

      const patch = {
        contractor_id: contractorId,
        status: "assigned",
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (change) patch.reassignment_count = (assignment.reassignment_count || 0) + 1;

      const { error } = await supabase
        .from("helpdesk_assignments")
        .update(patch)
        .eq("id", assignment.id);
      if (error) throw error;

      setAssignFor(null);
      await loadData();
    } catch (e) {
      alert("Failed to assign: " + (e.message || "Please try again."));
    }
  };

  /* UI */
  if (authReady && !user) {
    return (
      <div className={`min-h-screen grid place-items-center ${PAGE_BG} text-white`}>
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Please sign in again</h2>
        </div>
      </div>
    );
  }
  if (loading) return <div className={`min-h-screen grid place-items-center text-white ${PAGE_BG}`}>Loading…</div>;

  return (
    <div className={`min-h-screen ${PAGE_BG} text-white`}>
      <div className="max-w-7xl mx-auto p-6">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Building2 className="w-7 h-7 text-blue-400" />
            <h1 className="text-3xl font-bold">Helpdesk Dashboard</h1>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/20 hover:bg-white/10",
              refreshing && "opacity-60 cursor-not-allowed"
            )}
          >
            <RefreshCcw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            <span className="text-sm">Refresh</span>
          </button>
        </header>

        {/* Filters */}
        <div className="grid md:grid-cols-3 gap-3 mb-6">
          <select className={`rounded-lg px-3 py-2 ${INPUT_BG} border ${INPUT_BORDER}`} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="accepted">Accepted</option>
            <option value="review">Review</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>

          <select className={`rounded-lg px-3 py-2 ${INPUT_BG} border ${INPUT_BORDER}`} value={propertyFilter} onChange={e => setPropertyFilter(e.target.value)}>
            {propertyOptions.map(opt => <option key={opt} value={opt}>{opt === "all" ? "All Properties" : opt}</option>)}
          </select>

          <input
            className={`rounded-lg px-3 py-2 ${INPUT_BG} border ${INPUT_BORDER}`}
            placeholder="Search title or description…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(a => {
            const mr = a.maintenance_reports || {};
            const prop = mr.property || {};
            const s = STATUS[a.status] || STATUS.pending;

            return (
              <div
                key={a.id}
                className={cn(
                  "rounded-2xl p-4 shadow-sm border",
                  PANEL_BG, PANEL_BORDER,
                  "hover:border-white/20 transition",
                  "ring-1", s.ring
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-white/50 mb-1">#{a.id.slice(0,8)}</div>
                    <div className="text-lg font-semibold">{mr.title || "Maintenance Request"}</div>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                        <Tag className="w-3 h-3" /> {mr.category || "—"}
                      </span>
                      <span className="text-xs text-white/60">Urgency: {mr.urgency || "—"}</span>
                    </div>

                    <div className="text-sm text-white/70 mt-1">
                      {prop.name || "—"} • {prop.address || mr.address || "—"} • Unit {mr.location || "—"}
                    </div>
                    <div className="text-xs text-white/50">Created: {fmtDate(mr.created_at)}</div>
                    <div className="text-xs text-white/50">Reassignments: {a.reassignment_count || 0}</div>
                  </div>

                  <span className={cn("text-xs px-2 py-1 rounded-full", s.badge)}>{a.status}</span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button className="text-sm px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/10"
                    onClick={() => setDetailsFor(a)}
                  >
                    <Info className="w-4 h-4 inline mr-1" /> Details
                  </button>

                  <button className="text-sm px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/10"
                    onClick={() => openAssign(a)}
                  >
                    <UserPlus className="w-4 h-4 inline mr-1" /> {a.contractor_id ? "Reassign" : "Assign"}
                  </button>

                  {(a.status === "review") && (
                    <button className="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                      onClick={() => markCompleted(a)}
                    >
                      <CheckCircle2 className="w-4 h-4 inline mr-1" /> Mark Completed
                    </button>
                  )}

                  {(a.status === "completed") && (
                    <button className="text-sm px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/10"
                      onClick={() => reopenToPending(a)}
                    >
                      <Undo2 className="w-4 h-4 inline mr-1" /> Reopen
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {!filtered.length && (
            <div className="col-span-full text-white/60 text-sm border border-white/10 rounded-xl p-4">
              No results.
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {detailsFor && (
        <DetailsModal
          assignment={detailsFor}
          onClose={() => setDetailsFor(null)}
          getSigned={getSigned}
        />
      )}

      {/* Assign/Reassign Modal */}
      {assignFor && (
        <AssignModal
          assignment={assignFor}
          onClose={() => setAssignFor(null)}
          contractors={contractors}
          rejectedBy={rejectedBy}
          onAssign={(cid) => doAssign(assignFor, cid)}
        />
      )}
    </div>
  );
}

/* ========================= Modals ========================= */

function DetailsModal({ assignment, onClose, getSigned }) {
  const a = assignment || {};
  const mr = a.maintenance_reports || {};
  const prop = mr.property || {};
  const tenantAttachments = mr.attachments || [];

  const [finalReport, setFinalReport] = useState(null);
  const [parts, setParts] = useState([]);
  const [contractorAttachments, setContractorAttachments] = useState([]);

  // invoice
  const [invoiceUrl, setInvoiceUrl] = useState(null);
  const [invoicePath, setInvoicePath] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!a?.id) return;
    (async () => {
      const { data: fr } = await supabase
        .from("contractor_final_reports")
        .select("id, report_text, appliance_name, appliance_brand, parts_subtotal, tax_rate, total_cost, created_at")
        .eq("assignment_id", a.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setFinalReport(fr || null);

      if (fr?.id) {
        const [{ data: pr }, { data: att }] = await Promise.all([
          supabase.from("contractor_final_parts")
            .select("part_name, brand, qty, unit_price, line_total")
            .eq("final_report_id", fr.id)
            .order("created_at", { ascending: true }),
          supabase.from("attachments")
            .select("*")
            .eq("contractor_final_report_id", fr.id)
        ]);
        setParts(pr || []);
        setContractorAttachments(att || []);

        // surface existing invoice if present
        const invoice = (att || []).find(x => (x.file_type === "pdf") && x.file_path?.includes("/invoices/"));
        if (invoice?.file_path) {
          const { data: s } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(invoice.file_path, 3600);
          setInvoiceUrl(s?.signedUrl || null);
          setInvoicePath(invoice.file_path);
        }
      } else {
        setParts([]);
        setContractorAttachments([]);
      }
    })();
  }, [a?.id]);

  const generateInvoice = async () => {
    if (!finalReport) return;
    setGenerating(true);
    try {
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF({ unit: "pt", format: "a4" });

      const margin = 48; let y = margin;
      const add = (text, opts={}) => { doc.setFontSize(opts.size || 11); doc.text(String(text), margin, y); y += opts.line || 18; };

      doc.setFont("helvetica", "bold");
      add("INVOICE", { size: 18, line: 26 });
      doc.setFont("helvetica", "normal");
      add(`Assignment: ${a.id}`);
      add(`Property: ${prop?.name || "—"} — ${prop?.address || mr.address || "—"} — Unit ${mr.location || "—"}`);
      add(`Date: ${new Date().toLocaleDateString()}`, { line: 24 });

      doc.setFont("helvetica", "bold"); add("Job Summary", { line: 20 });
      doc.setFont("helvetica", "normal");
      add(`Appliance: ${finalReport.appliance_name || "—"}`);
      add(`Brand: ${finalReport.appliance_brand || "—"}`);
      add("", { line: 6 });
      const notes = (finalReport.report_text || "").trim();
      if (notes) {
        const wrapped = doc.splitTextToSize(notes, 520);
        wrapped.forEach(line => { doc.text(line, margin, y); y += 16; });
        y += 6;
      }

      // Parts table
      doc.setFont("helvetica", "bold"); add("Parts", { line: 20 });
      doc.setFont("helvetica", "normal");
      doc.text("Part", margin, y);
      doc.text("Brand", margin + 220, y);
      doc.text("Qty", margin + 350, y);
      doc.text("Unit (AED)", margin + 400, y);
      doc.text("Line (AED)", margin + 500, y);
      y += 12; doc.line(margin, y, 560, y); y += 14;

      parts.forEach(p => {
        const lineY = y;
        const partLines = doc.splitTextToSize(p.part_name || "", 200);
        doc.text(partLines, margin, y);
        doc.text(String(p.brand || "—"), margin + 220, y);
        doc.text(String(p.qty ?? 0), margin + 350, y);
        doc.text((Number(p.unit_price)||0).toFixed(2), margin + 400, y);
        doc.text((Number(p.line_total)||0).toFixed(2), margin + 500, y);
        y = lineY + Math.max(18, partLines.length * 14);
      });

      y += 10; doc.line(margin, y, 560, y); y += 16;

      const subtotal = Number(finalReport.parts_subtotal || 0);
      const vatPct = (Number(finalReport.tax_rate || 0) * 100);
      const total = Number(finalReport.total_cost || subtotal);
      add(`Subtotal: AED ${subtotal.toFixed(2)}`);
      add(`VAT %: ${vatPct.toFixed(2)}`);
      doc.setFont("helvetica", "bold");
      add(`Total: AED ${total.toFixed(2)}`, { line: 26 });
      doc.setFont("helvetica", "normal");

      // Upload
      const blob = doc.output("blob");
      const fileName = `invoice-${a.id}.pdf`;
      const storagePath = `invoices/${a.id}/${fileName}`;

      const { error: upErr } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(storagePath, blob, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;

      // Register in attachments:
      // IMPORTANT: satisfy "one_fk_only" → ONLY contractor_final_report_id (report_id MUST be null)
      const { error: insErr } = await supabase.from("attachments").insert({
        contractor_final_report_id: finalReport.id,
        report_id: null,
        file_name: fileName,
        file_path: storagePath,
        file_type: "pdf",
        file_size: blob.size
      });
      if (insErr) throw insErr;

      const { data: s } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(storagePath, 3600);
      setInvoiceUrl(s?.signedUrl || null);
      setInvoicePath(storagePath);
      alert("Invoice generated and uploaded.");
    } catch (e) {
      console.error(e);
      alert("Failed to generate invoice: " + (e.message || "Please try again."));
    } finally {
      setGenerating(false);
    }
  };

  const sendInvoice = async () => {
    const url = process.env.REACT_APP_N8N_SEND_INVOICE_WEBHOOK;
    if (!url) { alert("Webhook URL not configured yet."); return; }
    if (!finalReport) { alert("No final report found."); return; }
    setSending(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignment_id: a.id,
          final_report_id: finalReport.id,
          pdf_path: invoicePath || null
        })
      });
      if (!res.ok) throw new Error(await res.text());
      alert("Invoice sent.");
    } catch (e) {
      console.error(e);
      alert("Failed to send invoice: " + (e.message || "Please try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4">
      <div className="bg-[#0f172a] text-white rounded-2xl shadow-xl max-w-6xl w-full p-6 relative">
        <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={onClose}>✕</button>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: tenant report */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="w-5 h-5 text-blue-400" />
              <h3 className="text-xl font-semibold">{mr.title || "Maintenance Request"}</h3>
            </div>
            <div className="text-sm text-white/70 mb-1">{prop.name || "—"} • {prop.address || mr.address || "—"}</div>
            <div className="text-sm text-white/70 mb-3">Unit: {mr.location || "—"} • Urgency: {mr.urgency || "—"} • Category: {mr.category || "—"}</div>
            <p className="text-white/90 whitespace-pre-wrap mb-4">{mr.description || "—"}</p>

            {(tenantAttachments||[])?.length > 0 && (
              <>
                <div className="font-semibold mb-2">Tenant Attachments</div>
                <div className="grid grid-cols-3 gap-3">
                  {tenantAttachments.map(att => (
                    <AttachmentThumb key={att.id} att={att} getSigned={getSigned} />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Right: contractor final report + invoice */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-emerald-400" />
              <h4 className="text-lg font-semibold">Contractor Final Report</h4>
            </div>

            {!finalReport ? (
              <div className="text-sm text-white/70">Waiting for contractor’s final report…</div>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-white/60">Appliance:</span> {finalReport.appliance_name || "—"}</div>
                  <div><span className="text-white/60">Brand:</span> {finalReport.appliance_brand || "—"}</div>
                  <div><span className="text-white/60">Subtotal:</span> AED {(finalReport.parts_subtotal ?? 0).toFixed(2)}</div>
                  <div><span className="text-white/60">VAT%:</span> {((finalReport.tax_rate || 0) * 100).toFixed(2)}</div>
                  <div className="sm:col-span-2"><span className="text-white/60">Total:</span> AED {(finalReport.total_cost ?? 0).toFixed(2)}</div>
                </div>

                {parts?.length > 0 && (
                  <div className="mt-4">
                    <div className="text-sm font-semibold mb-2">Parts</div>
                    <div className="text-sm overflow-x-auto">
                      <table className="w-full text-left border-separate" style={{ borderSpacing: 0 }}>
                        <thead className="text-white/70">
                          <tr>
                            <th className="py-1 pr-2">Part</th>
                            <th className="py-1 pr-2">Brand</th>
                            <th className="py-1 pr-2">Qty</th>
                            <th className="py-1 pr-2">Unit (AED)</th>
                            <th className="py-1 pr-2">Line (AED)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parts.map((p, i) => (
                            <tr key={i} className="border-t border-white/10">
                              <td className="py-1 pr-2">{p.part_name}</td>
                              <td className="py-1 pr-2">{p.brand || "—"}</td>
                              <td className="py-1 pr-2">{p.qty}</td>
                              <td className="py-1 pr-2">{Number(p.unit_price).toFixed(2)}</td>
                              <td className="py-1 pr-2">{Number(p.line_total).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {(contractorAttachments||[])?.length > 0 && (
                  <>
                    <div className="font-semibold mt-6 mb-2">Contractor Evidence</div>
                    <div className="grid grid-cols-3 gap-3">
                      {contractorAttachments.map(att => (
                        <AttachmentThumb key={att.id} att={att} getSigned={getSigned} />
                      ))}
                    </div>
                  </>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <button
                    onClick={generateInvoice}
                    disabled={generating}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-60"
                  >
                    <FileUp className="w-4 h-4" />
                    {generating ? "Generating…" : "Generate Invoice (PDF)"}
                  </button>

                  {invoiceUrl && (
                    <a
                      href={invoiceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/10"
                    >
                      <Eye className="w-4 h-4" />
                      View Invoice
                    </a>
                  )}

                  {(a.status === "completed") && (
                    <button
                      onClick={sendInvoice}
                      disabled={sending}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60"
                    >
                      {sending ? "Sending…" : "Send Invoice"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AttachmentThumb({ att, getSigned }) {
  const [url, setUrl] = useState(null);
  useEffect(() => { (async () => setUrl(await getSigned(att.file_path)))(); }, [att, getSigned]);
  const type = att.file_type || "file";
  if (!url) return <div className="aspect-video rounded-lg border border-white/10 bg-white/5" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <div className="aspect-video rounded-lg overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center">
        {type === "image" ? <img src={url} alt={att.file_name} className="w-full h-full object-cover" /> :
         type === "video" ? <video src={url} controls className="w-full h-full object-cover" /> :
         <div className="p-6 text-white/70 text-sm">{att.file_name}</div>}
      </div>
      <div className="mt-1 text-xs text-white/60 truncate">{att.file_name}</div>
    </a>
  );
}

/* =============== Assign / Reassign Modal =============== */

function AssignModal({ assignment, onClose, contractors, rejectedBy, onAssign }) {
  const [choice, setChoice] = useState(assignment?.contractor_id || "");
  const mr = assignment?.maintenance_reports || {};
  const ticketCategory = (mr.category || "").toLowerCase();

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4">
      <div className="bg-[#0f172a] text-white rounded-2xl shadow-xl max-w-lg w-full p-6 relative">
        <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={onClose}>✕</button>
        <div className="mb-4">
          <div className="text-xl font-semibold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-400" /> Assign Contractor
          </div>
          <div className="text-sm text-white/70 mt-1">
            Category required: <span className="font-medium text-white">{mr.category || "—"}</span>
          </div>
          <div className="text-xs text-white/50 mt-1">
            Contractors who previously <span className="text-rose-300 font-medium">rejected</span> or don’t serve this category are disabled.
          </div>
        </div>

        <div className="space-y-2 mb-4 max-h-80 overflow-y-auto pr-1">
          {contractors.map(c => {
            const services = Array.isArray(c.services_provided) ? c.services_provided.map(s => (s || "").toLowerCase()) : [];
            const categoryOk = ticketCategory ? services.includes(ticketCategory) : true;
            const rejected = rejectedBy.has(c.id);
            const disabled = rejected || !categoryOk;

            return (
              <label key={c.id} className={cn(
                "flex items-start gap-3 p-3 rounded-lg border",
                disabled ? "border-white/10 bg-white/[0.04] opacity-60 cursor-not-allowed" : "border-white/10 hover:bg-white/10 cursor-pointer"
              )}>
                <input
                  type="radio"
                  name="ctr"
                  className="mt-1"
                  disabled={disabled}
                  checked={choice === c.id}
                  onChange={() => setChoice(c.id)}
                />
                <div className="flex-1">
                  <div className="font-medium">{c.full_name || "—"}</div>
                  <div className="text-xs text-white/70 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>
                    {c.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>}
                  </div>
                  {rejected && (
                    <div className="text-xs text-rose-300 mt-1 inline-flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> rejected this ticket
                    </div>
                  )}
                  {!rejected && !categoryOk && (
                    <div className="text-xs text-amber-300 mt-1 inline-flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> not in services for {mr.category}
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/10">Cancel</button>
          <button
            disabled={!choice}
            onClick={() => onAssign(choice)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60"
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}
