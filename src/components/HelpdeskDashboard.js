// src/components/HelpdeskDashboard.js
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { ClipboardList, UserCheck, CheckCircle, X, Search, RefreshCcw, Eye } from 'lucide-react';

// Private storage bucket
const ATTACHMENTS_BUCKET = 'maintenance-files';

const STATUS_COLORS = {
  pending: 'bg-yellow-600',
  assigned: 'bg-blue-600',
  accepted: 'bg-emerald-600',
  review: 'bg-purple-700',
  rejected: 'bg-red-600',
  completed: 'bg-gray-600',
};
function Badge({ status }) {
  const color = STATUS_COLORS[status] || 'bg-slate-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color} text-white`}>
      {status?.[0]?.toUpperCase()}{status?.slice(1)}
    </span>
  );
}

/* ---------- Storage helpers (signed URLs for private bucket) ---------- */
function parseBucketAndPath(filePath) {
  try {
    const u = new URL(filePath);
    const segs = u.pathname.split('/').filter(Boolean);
    const i = segs.findIndex(s => s === 'object');
    if (i >= 0 && segs.length >= i + 3) {
      const bucket = segs[i + 2];
      const obj = segs.slice(i + 3).join('/');
      if (bucket && obj) return { bucket, path: obj };
    }
  } catch (_) {}
  return { bucket: ATTACHMENTS_BUCKET, path: String(filePath).replace(/^\/+/, '') };
}
async function signUrl(filePath, expiresIn = 3600) {
  const { bucket, path } = parseBucketAndPath(filePath);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  return error ? filePath : (data?.signedUrl || filePath);
}

export default function HelpdeskDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [rows, setRows] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [rejectByAssignment, setRejectByAssignment] = useState({});

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProperty, setFilterProperty] = useState('all');
  const [q, setQ] = useState('');

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [selectedContractorId, setSelectedContractorId] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);

  // Details modal (lazy sign urls)
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [attachments, setAttachments] = useState([]);              // tenant attachments
  const [attachmentsUrls, setAttachmentsUrls] = useState({});      // {id: signedUrl}
  const [finalReport, setFinalReport] = useState(null);            // latest contractor final report
  const [finalEvidence, setFinalEvidence] = useState([]);          // files attached to that final report
  const [finalEvidenceUrls, setFinalEvidenceUrls] = useState({});  // {id: signedUrl}

  useEffect(() => {
    let mounted = true;
    async function boot() {
      setLoading(true);
      try {
        const [assignments, contractorList] = await Promise.all([
          fetchAssignmentsWithReportDetails(),
          fetchContractors()
        ]);

        let rejectionMap = {};
        if (assignments.length) {
          const ids = assignments.map(a => a.id);
          rejectionMap = await fetchLatestRejections(ids);
        }

        if (!mounted) return;
        setRows(assignments);
        setContractors(contractorList);
        setRejectByAssignment(rejectionMap);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    boot();
    return () => { mounted = false; };
  }, []);

  async function fetchContractors() {
    const { data, error } = await supabase
      .from('contractors')
      .select('id, full_name, email, phone, services_provided')
      .order('full_name');
    if (error) throw error;
    return (data || []).map(c => ({
      id: c.id,
      name: c.full_name || (c.email?.split('@')[0]) || 'Contractor',
      email: c.email,
      phone: c.phone || '',
      services: Array.isArray(c.services_provided) ? c.services_provided.map(String) : [],
    }));
  }

  /** Load all assignments (all statuses), joined with MR + property for display */
  async function fetchAssignmentsWithReportDetails() {
    const joined = await supabase
      .from('helpdesk_assignments')
      .select(`
        id, report_id, landlord_id, status, contractor_id, reassignment_count, assigned_at, response_at, created_at, updated_at,
        contractor:contractor_id ( id, full_name, email ),
        maintenance_reports:report_id (
          id, title, description, property_id, created_at, urgency, category, status,location,
          property:property_id ( id, name, address )
        )
      `)
      .order('created_at', { ascending: false });

    if (joined.error) throw joined.error;
    return (joined.data || []).map(a => shapeRow(a, a.maintenance_reports || null));
  }

  function shapeRow(a, report) {
    const title = report?.title ?? `Ticket #${a.report_id || a.id}`;
    const description = report?.description ?? '';
    const property_id = report?.property_id ?? null;
    const location = report?.location ?? null;
    const property_name = report?.property?.name ?? null;
    const created_at = report?.created_at ?? a.created_at;
    const urgency = (report?.urgency || 'medium').toString();
    const category = (report?.category || '').toString();
    const contractor_name = a.contractor?.full_name || null;

    return {
      id: a.id,
      report_id: a.report_id ?? null,
      landlord_id: a.landlord_id ?? null,
      status: a.status ?? 'pending',
      contractor_id: a.contractor_id ?? null,
      contractor_name,
      reassignment_count: typeof a.reassignment_count === 'number' ? a.reassignment_count : 0,
      assigned_at: a.assigned_at ?? null,
      response_at: a.response_at ?? null,
      created_at: created_at ?? a.created_at,

      title,
      description,
      property_id,
      property_name,
      location,
      urgency,
      category,

      _raw: a,
      _report: report || null,
    };
  }

  async function fetchLatestRejections(assignmentIds) {
    const { data, error } = await supabase
      .from('contractor_responses')
      .select('assignment_id, contractor_id, response, notes, response_at')
      .in('assignment_id', assignmentIds)
      .order('response_at', { ascending: false });
    if (error) throw error;
    const map = {};
    for (const r of data || []) {
      if (r.response === 'rejected' && r.assignment_id && !map[r.assignment_id]) {
        map[r.assignment_id] = { notes: r.notes || '(no reason)', response_at: r.response_at, contractor_id: r.contractor_id };
      }
    }
    return map;
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const assignments = await fetchAssignmentsWithReportDetails();
      let rejectionMap = {};
      if (assignments.length) {
        const ids = assignments.map(a => a.id);
        rejectionMap = await fetchLatestRejections(ids);
      }
      setRows(assignments);
      setRejectByAssignment(rejectionMap);
    } finally {
      setRefreshing(false);
    }
  }

  function openAssignModal(item) {
    setSelected(item);
    setSelectedContractorId(item.contractor_id || '');
    setAssignModalOpen(true);
  }
  function closeAssignModal() {
    setAssignModalOpen(false);
    setSelected(null);
    setSelectedContractorId('');
  }

  function openDetails(item) {
    setSelected(item);
    setDetailsOpen(true);
    setDetailsLoading(true);
    setAttachments([]);
    setAttachmentsUrls({});
    setFinalReport(null);
    setFinalEvidence([]);
    setFinalEvidenceUrls({});
    (async () => {
      try {
        const [{ data: atts, error: attErr }, { data: frs }] = await Promise.all([
          supabase
            .from('attachments')
            .select('id, file_name, file_type, file_size, file_path, created_at')
            .eq('report_id', item.report_id)
            .order('created_at', { ascending: true }),
          supabase
            .from('contractor_final_reports')
            .select('id, contractor_id, report_text, created_at')
            .eq('assignment_id', item.id)
            .order('created_at', { ascending: false })
            .limit(1)
        ]);
        if (attErr) throw attErr;
        setAttachments(atts || []);

        const urlMap = {};
        for (const a of atts || []) urlMap[a.id] = await signUrl(a.file_path);
        setAttachmentsUrls(urlMap);

        const fr = (frs && frs[0]) || null;
        setFinalReport(fr);

        if (fr?.id) {
          const { data: ev } = await supabase
            .from('attachments')
            .select('id, file_name, file_type, file_size, file_path, created_at')
            .eq('contractor_final_report_id', fr.id)
            .order('created_at', { ascending: true });
          setFinalEvidence(ev || []);
          const evMap = {};
          for (const a of ev || []) evMap[a.id] = await signUrl(a.file_path);
          setFinalEvidenceUrls(evMap);
        }
      } finally {
        setDetailsLoading(false);
      }
    })();
  }
  function closeDetails() {
    setDetailsOpen(false);
    setSelected(null);
    setAttachments([]);
    setAttachmentsUrls({});
    setFinalReport(null);
    setFinalEvidence([]);
    setFinalEvidenceUrls({});
  }

  function isEligibleForCategory(contractor, category) {
    if (!category) return true;
    const list = contractor.services.map(s => s.toLowerCase().trim());
    return list.includes(category.toLowerCase().trim());
  }
  function wasRejectedBefore(assignmentId, contractorId) {
    const r = rejectByAssignment[assignmentId];
    return r && r.contractor_id === contractorId;
  }
  function contractorOptionsFor(item) {
    return contractors.map(c => {
      const inCategory = isEligibleForCategory(c, item.category);
      const rejected = wasRejectedBefore(item.id, c.id);
      const disabled = !inCategory || rejected;
      const reason = rejected ? 'refused' : (!inCategory ? 'service-mismatch' : null);
      return { ...c, disabled, reason };
    });
  }

  async function assignContractor() {
    if (!selected || !selectedContractorId) return;
    const chosen = contractors.find(c => c.id === selectedContractorId);
    if (chosen && !isEligibleForCategory(chosen, selected.category)) {
      alert('This contractor does not provide the required service/category.');
      return;
    }
    if (wasRejectedBefore(selected.id, selectedContractorId)) {
      alert('This contractor already refused this assignment.');
      return;
    }

    setSavingAssign(true);
    try {
      const now = new Date().toISOString();
      const increment =
        selected.contractor_id && selected.contractor_id !== selectedContractorId ? 1 : 0;

      const { error } = await supabase
        .from('helpdesk_assignments')
        .update({
          contractor_id: selectedContractorId,
          status: 'assigned',
          reassignment_count: (selected.reassignment_count ?? 0) + increment,
          assigned_at: now,
          response_at: null,
          updated_at: now,
        })
        .eq('id', selected.id);

      if (error) throw error;

      setRows(prev =>
        prev.map(a =>
          a.id === selected.id
            ? {
                ...a,
                contractor_id: selectedContractorId,
                contractor_name: chosen?.name || a.contractor_name,
                status: 'assigned',
                reassignment_count: (a.reassignment_count ?? 0) + increment,
                assigned_at: now,
              }
            : a
        )
      );

      closeAssignModal();
    } catch (e) {
      alert(e.message || 'Failed to assign contractor.');
    } finally {
      setSavingAssign(false);
    }
  }

  async function markCompleted(item) {
    if (!item) return;
    if (!confirm('Mark this assignment as completed?')) return;
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('helpdesk_assignments')
        .update({ status: 'completed', completed_at: now, updated_at: now })
        .eq('id', item.id);
      if (error) throw error;
      setRows(prev => prev.map(a => a.id === item.id ? ({ ...a, status: 'completed' }) : a));
      // (n8n hook later)
    } catch (e) {
      alert(e.message || 'Failed to mark completed.');
    }
  }

  async function reopenAssignment(item) {
    if (!item) return;
    if (!confirm('Reopen this assignment and move it back to Pending (unassigned)?')) return;
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('helpdesk_assignments')
        .update({
          status: 'pending',
          contractor_id: null,
          assigned_at: null,
          response_at: null,
          updated_at: now,
        })
        .eq('id', item.id);
      if (error) throw error;

      setRows(prev =>
        prev.map(a =>
          a.id === item.id
            ? {
                ...a,
                status: 'pending',
                contractor_id: null,
                contractor_name: null,
                assigned_at: null,
                response_at: null,
                updated_at: now,
              }
            : a
        )
      );
    } catch (e) {
      alert(e.message || 'Failed to reopen assignment.');
    }
  }

  const propertyOptions = useMemo(() => {
    const names = new Map();
    rows.forEach(r => {
      const key = r.property_name || r.property_id || 'Unknown';
      const label = r.property_name || `Property #${r.property_id?.slice?.(0, 8) ?? r.property_id}`;
      names.set(String(key), label);
    });
    return Array.from(names.entries()).map(([value, label]) => ({ value, label }));
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filterStatus !== 'all') list = list.filter(r => (r.status || 'pending') === filterStatus);
    if (filterProperty !== 'all') list = list.filter(r => String(r.property_name || r.property_id) === filterProperty);
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter(r =>
        (r.title || '').toLowerCase().includes(t) ||
        (r.description || '').toLowerCase().includes(t)
      );
    }
    return list;
  }, [rows, filterStatus, filterProperty, q]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6" />
            <h1 className="text-xl font-semibold">Helpdesk Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-60"
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-300">Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm">
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="accepted">Accepted</option>
              <option value="review">Review</option>
              <option value="rejected">Rejected</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-300">Property</label>
            <select value={filterProperty} onChange={(e) => setFilterProperty(e.target.value)} className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm">
              <option value="all">All</option>
              {propertyOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
          </div>
          <div className="relative flex-1">
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search title or description…"
              className="w-full bg-white/10 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-slate-400"
            />
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid place-items-center py-20">
            <div className="flex flex-col items-center gap-4 text-slate-300">
              <div className="h-10 w-10 border-2 border-slate-600 border-t-white rounded-full animate-spin" />
              <p>Loading assignments…</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center py-20 text-slate-300">
            <p>No assignments found.</p>
          </div>
        ) : (
          <ul className="grid md:grid-cols-2 gap-4">
            {filtered.map(item => {
              const lastRej = rejectByAssignment[item.id];
              return (
                <li key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                        <Badge status={item.status} />
                        <span className="opacity-60">•</span>
                        <span>Urgency: <span className="uppercase tracking-wide">{item.urgency}</span></span>
                        {item.category && (<><span className="opacity-60">•</span><span>Category: {item.category}</span></>)}
                        {item.property_name && (<><span className="opacity-60">•</span><span>Property: {item.property_name}</span></>)}
                        {item.location && (<><span className="opacity-60">•</span><span>Unit: {item.location}</span></>)}
                        <span className="opacity-60">•</span>
                        <span>{new Date(item.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      {typeof item.reassignment_count === 'number' && (<div>Reassignments: {item.reassignment_count}</div>)}
                      <div>Contractor: {item.contractor_name ? <span className="font-medium">{item.contractor_name}</span> : <span className="italic text-slate-400">none</span>}</div>
                    </div>
                  </div>

                  {item.description && (
                    <p className="mt-3 text-sm text-slate-200 whitespace-pre-wrap">{item.description}</p>
                  )}

                  {lastRej && (
                    <div className="mt-3 text-xs rounded-lg bg-red-500/10 border border-red-500/30 p-2 text-red-200">
                      Last rejection: <span className="italic">{lastRej.notes}</span>
                      <span className="opacity-60"> — {new Date(lastRej.response_at).toLocaleString()}</span>
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    {item.status === 'completed' ? (
                      <>
                        <button onClick={() => reopenAssignment(item)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700">
                          Reopen
                        </button>
                        <button onClick={() => openDetails(item)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/10">
                          <Eye className="h-4 w-4" />
                          View details
                        </button>
                      </>
                    ) : item.status === 'review' ? (
                      <>
                        <button onClick={() => openDetails(item)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/10">
                          <Eye className="h-4 w-4" />
                          View details
                        </button>
                        <button onClick={() => markCompleted(item)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700">
                          <CheckCircle className="h-4 w-4" />
                          Mark completed
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => openAssignModal(item)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700">
                          <UserCheck className="h-4 w-4" />
                          Assign / Reassign
                        </button>
                        <button onClick={() => openDetails(item)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/10">
                          <Eye className="h-4 w-4" />
                          View details
                        </button>
                        <button onClick={() => markCompleted(item)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700">
                          <CheckCircle className="h-4 w-4" />
                          Mark completed
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* Assign contractor modal */}
      {assignModalOpen && selected && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={closeAssignModal} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-white/10 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Assign contractor</h2>
                <button onClick={closeAssignModal} className="p-1 rounded hover:bg-white/10"><X className="h-5 w-5" /></button>
              </div>

              <div className="mt-4 space-y-1 text-sm">
                <div className="text-slate-300">Assignment ID: <span className="text-white font-medium">{selected.id}</span></div>
                <div className="text-slate-300">Ticket: <span className="text-white font-medium">{selected.title}</span></div>
                <div className="text-slate-300">Category: {selected.category || '—'}</div>
                <div className="text-slate-300">Urgency: {selected.urgency}</div>
                <div className="text-slate-300">Current status: <Badge status={selected.status} /></div>
                <div className="text-slate-300">
                  Current contractor:{' '}
                  {selected.contractor_name ? <span className="font-medium">{selected.contractor_name}</span> : <span className="italic text-slate-400">none</span>}
                </div>
              </div>

              <label className="mt-6 block text-sm">
                <span className="text-slate-300">Choose contractor</span>
                <select
                  className="mt-1 w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2"
                  value={selectedContractorId}
                  onChange={(e) => setSelectedContractorId(e.target.value)}
                >
                  <option value="">— Select —</option>
                  {contractorOptionsFor(selected).map(opt => (
                    <option key={opt.id} value={opt.id} disabled={opt.disabled}>
                      {opt.name} — {opt.email}
                      {opt.phone ? ` (${opt.phone})` : ''}
                      {opt.reason === 'refused' ? ' — refused'
                        : opt.reason === 'service-mismatch' ? ' — unavailable for category'
                        : ''}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button onClick={closeAssignModal} className="px-4 py-2 rounded-lg border border-white/10">Cancel</button>
                <button onClick={assignContractor} disabled={!selectedContractorId || savingAssign} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
                  {savingAssign ? 'Assigning…' : 'Assign contractor'}
                </button>
              </div>

              <p className="mt-4 text-xs text-slate-400">
                Contractors matching the ticket’s category are selectable. Those who previously refused this assignment are disabled.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Details modal (left: report + attachments, right: final report + evidence) */}
      {detailsOpen && selected && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={closeDetails} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-full max-w-5xl rounded-2xl bg-slate-900 border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold">{selected.title}</h2>
                  <div className="text-sm text-slate-300 flex gap-2 flex-wrap">
                    <Badge status={selected.status} />
                    {selected.property_name && <span>Property: {selected.property_name}</span>}
                    {selected.location && <span>Unit: {selected.location}</span>}
                    <span>Urgency: {selected.urgency}</span>
                    {selected.category && <span>Category: {selected.category}</span>}
                  </div>
                </div>
                <button onClick={closeDetails} className="p-1 rounded hover:bg-white/10"><X className="h-5 w-5" /></button>
              </div>

              {detailsLoading ? (
                <div className="py-10 text-center text-slate-300">Loading details…</div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left: Tenant report + attachments (signed) */}
                  <div className="rounded-xl border border-white/10 p-4">
                    <h3 className="font-semibold mb-2">Report details</h3>
                    <p className="text-sm text-slate-200 whitespace-pre-wrap mb-4">{selected.description || '—'}</p>

                    <h4 className="text-sm font-medium text-slate-300 mb-2">Attachments</h4>
                    {attachments.length === 0 ? (
                      <div className="text-sm text-slate-400">No attachments.</div>
                    ) : (
                      <ul className="space-y-2">
                        {attachments.map(a => (
                          <li key={a.id} className="text-sm">
                            <a className="text-blue-300 hover:underline break-all" href={attachmentsUrls[a.id]} target="_blank" rel="noreferrer">
                              {a.file_name}
                            </a>
                            <span className="text-slate-400"> — {a.file_type} · {(a.file_size ?? 0)} bytes</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Right: Contractor final report + evidence (signed) */}
                  <div className="rounded-xl border border-white/10 p-4">
                    <h3 className="font-semibold mb-2">Contractor final report</h3>
                    {finalReport ? (
                      <>
                        <div className="text-sm text-slate-300 mb-2">Submitted: {new Date(finalReport.created_at).toLocaleString()}</div>
                        <p className="text-sm text-slate-200 whitespace-pre-wrap mb-4">{finalReport.report_text}</p>

                        <h4 className="text-sm font-medium text-slate-300 mb-2">Evidence</h4>
                        {finalEvidence.length === 0 ? (
                          <div className="text-sm text-slate-400">No files.</div>
                        ) : (
                          <ul className="space-y-2">
                            {finalEvidence.map(a => (
                              <li key={a.id} className="text-sm">
                                <a className="text-blue-300 hover:underline break-all" href={finalEvidenceUrls[a.id]} target="_blank" rel="noreferrer">
                                  {a.file_name}
                                </a>
                                <span className="text-slate-400"> — {a.file_type} · {(a.file_size ?? 0)} bytes</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-slate-400">Not submitted yet.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

