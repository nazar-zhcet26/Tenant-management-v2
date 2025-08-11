// src/components/HelpdeskDashboard.js
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { ClipboardList, UserCheck, UserX, CheckCircle, X, Search, RefreshCcw } from 'lucide-react';

const STATUS_COLORS = {
  pending: 'bg-yellow-600',
  assigned: 'bg-blue-600',
  accepted: 'bg-emerald-600',
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

export default function HelpdeskDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [rows, setRows] = useState([]);        // normalized assignment+report rows
  const [contractors, setContractors] = useState([]);

  const [filterStatus, setFilterStatus] = useState('all');
  const [q, setQ] = useState('');

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [selectedContractorId, setSelectedContractorId] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      setLoading(true);
      try {
        const [assignments, contractorList] = await Promise.all([
          fetchOpenAssignmentsWithReportDetails(),
          fetchContractors()
        ]);
        if (!mounted) return;
        setRows(assignments);
        setContractors(contractorList);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    boot();
    return () => { mounted = false; };
  }, []);

  async function fetchContractors() {
    // contractors table per your schema (not profiles)
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
      services: Array.isArray(c.services_provided) ? c.services_provided : [],
    }));
  }

  /**
   * Load from helpdesk_assignments (anything not completed).
   * Prefer a PostgREST join into maintenance_reports via FK on report_id.
   * Fallback to a 2-step fetch if join isn't configured for some reason.
   */
  async function fetchOpenAssignmentsWithReportDetails() {
    const joined = await supabase
      .from('helpdesk_assignments')
      .select(`
        *,
        maintenance_reports:maintenance_reports (
          id,
          title,
          description,
          property_id,
          created_at,
          urgency,
          status
        )
      `)
      .neq('status', 'completed')
      .order('created_at', { ascending: false });

    if (!joined.error && joined.data) {
      // Normalize both join and non-join (if maintenance_reports is null)
      return joined.data.map(a => shapeRow(a, a.maintenance_reports || null));
    }

    // Fallback: fetch assignments, then fetch reports by report_id
    const { data: assigns, error: aErr } = await supabase
      .from('helpdesk_assignments')
      .select('*')
      .neq('status', 'completed')
      .order('created_at', { ascending: false });

    if (aErr) throw aErr;

    const reportIds = Array.from(new Set((assigns || []).map(r => r.report_id).filter(Boolean)));
    let reportMap = {};
    if (reportIds.length) {
      const { data: reports, error: rErr } = await supabase
        .from('maintenance_reports')
        .select('id, title, description, property_id, created_at, urgency, status')
        .in('id', reportIds);
      if (!rErr && reports) {
        reportMap = Object.fromEntries(reports.map(r => [r.id, r]));
      }
    }

    return (assigns || []).map(a => shapeRow(a, reportMap[a.report_id]));
  }

  function shapeRow(a, report) {
    // a = helpdesk_assignments row
    const title = report?.title ?? a.title ?? `Ticket #${a.report_id || a.id}`;
    const description = report?.description ?? a.description ?? '';
    const property_id = report?.property_id ?? a.property_id ?? null;
    const created_at = report?.created_at ?? a.created_at;
    const urgency = report?.urgency ?? a.urgency ?? 'medium';

    return {
      // assignment fields
      id: a.id,
      report_id: a.report_id ?? null,
      landlord_id: a.landlord_id ?? null,
      status: a.status ?? 'pending',
      contractor_id: a.contractor_id ?? null,
      reassignment_count: typeof a.reassignment_count === 'number' ? a.reassignment_count : 0,
      assigned_at: a.assigned_at ?? null,
      response_at: a.response_at ?? null,
      created_at,

      // display extras from report
      title,
      description,
      property_id,
      urgency,

      // keep originals
      _raw: a,
      _report: report || null,
    };
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const data = await fetchOpenAssignmentsWithReportDetails();
      setRows(data);
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

  async function assignContractor() {
    if (!selected || !selectedContractorId) return;
    setSavingAssign(true);
    try {
      const nextCount = (selected.reassignment_count ?? 0) + 1;

      const { error } = await supabase
        .from('helpdesk_assignments')
        .update({
          contractor_id: selectedContractorId,
          status: 'assigned',
          reassignment_count: nextCount,
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selected.id);

      if (error) throw error;

      setRows(prev =>
        prev.map(a =>
          a.id === selected.id
            ? { ...a, contractor_id: selectedContractorId, status: 'assigned', reassignment_count: nextCount, assigned_at: new Date().toISOString() }
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
      const { error } = await supabase
        .from('helpdesk_assignments')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', item.id);

      if (error) throw error;

      setRows(prev => prev.filter(a => a.id !== item.id));
    } catch (e) {
      alert(e.message || 'Failed to mark completed.');
    }
  }

  const filtered = useMemo(() => {
    let list = rows;
    if (filterStatus !== 'all') list = list.filter(r => (r.status || 'pending') === filterStatus);
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter(r =>
        (r.title || '').toLowerCase().includes(t) ||
        (r.description || '').toLowerCase().includes(t)
      );
    }
    return list;
  }, [rows, filterStatus, q]);

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
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="relative flex-1">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
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
            <UserX className="h-8 w-8 mb-2" />
            <p>No open assignments found.</p>
          </div>
        ) : (
          <ul className="grid md:grid-cols-2 gap-4">
            {filtered.map(item => (
              <li key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-300">
                      <Badge status={item.status} />
                      <span className="opacity-60">•</span>
                      <span className="uppercase tracking-wide">Urgency: {item.urgency}</span>
                      {item.property_id && (
                        <>
                          <span className="opacity-60">•</span>
                          <span>Property #{item.property_id}</span>
                        </>
                      )}
                      <span className="opacity-60">•</span>
                      <span>{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    {typeof item.reassignment_count === 'number' && (
                      <div>Reassignments: {item.reassignment_count}</div>
                    )}
                    {item.contractor_id ? (
                      <div>Contractor: <span className="font-mono">{String(item.contractor_id).slice(0, 8)}…</span></div>
                    ) : (
                      <div>No contractor</div>
                    )}
                  </div>
                </div>

                {item.description && (
                  <p className="mt-3 text-sm text-slate-200 whitespace-pre-wrap">
                    {item.description}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => openAssignModal(item)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700"
                  >
                    <UserCheck className="h-4 w-4" />
                    Assign / Reassign
                  </button>

                  <button
                    onClick={() => markCompleted(item)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Mark completed
                  </button>
                </div>
              </li>
            ))}
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
                <button onClick={closeAssignModal} className="p-1 rounded hover:bg-white/10">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-1 text-sm">
                <div className="text-slate-300">Assignment ID: <span className="text-white font-medium">{selected.id}</span></div>
                <div className="text-slate-300">Ticket: <span className="text-white font-medium">{selected.title}</span></div>
                <div className="text-slate-300">Current status: <Badge status={selected.status} /></div>
                <div className="text-slate-300">
                  Current contractor:{' '}
                  {selected.contractor_id ? (
                    <span className="font-mono">{selected.contractor_id}</span>
                  ) : (
                    <span className="italic text-slate-400">none</span>
                  )}
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
                  {contractors.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.email}{c.phone ? ` (${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button onClick={closeAssignModal} className="px-4 py-2 rounded-lg border border-white/10">
                  Cancel
                </button>
                <button
                  onClick={assignContractor}
                  disabled={!selectedContractorId || savingAssign}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
                >
                  {savingAssign ? 'Assigning…' : 'Assign contractor'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
