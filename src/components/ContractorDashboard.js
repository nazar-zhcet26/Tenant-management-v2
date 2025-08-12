// src/components/ContractorDashboard.js
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { HardHat, Check, X, ClipboardCheck, Search, RefreshCcw, FileText, Loader2 } from 'lucide-react';

const STATUS_COLORS = {
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

export default function ContractorDashboard() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [contractor, setContractor] = useState(null); // {id, name, email, phone, services}
    const [rows, setRows] = useState([]);              // assignments for this contractor

    // No "pending" here:
    const [filterStatus, setFilterStatus] = useState('open'); // open | assigned | accepted | rejected | completed | all
    const [q, setQ] = useState('');

    const [actionBusyId, setActionBusyId] = useState(null);

    // Final report modal
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const [reportText, setReportText] = useState('');
    const [submittingReport, setSubmittingReport] = useState(false);

    useEffect(() => {
        let mounted = true;

        async function boot() {
            setLoading(true);
            try {
                const c = await resolveCurrentContractor();
                if (!mounted) return;
                setContractor(c);

                const data = await fetchAssignmentsForContractor(c.id);
                if (!mounted) return;
                setRows(data);
            } catch (e) {
                console.error(e);
                alert(e.message || 'Failed to load contractor dashboard.');
            } finally {
                if (mounted) setLoading(false);
            }
        }
        boot();

        return () => { mounted = false; };
    }, []);

    async function resolveCurrentContractor() {
        const { data: { session }, error: sErr } = await supabase.auth.getSession();
        if (sErr) throw sErr;
        const email = session?.user?.email;
        if (!email) throw new Error('No authenticated user email found.');

        const { data, error } = await supabase
            .from('contractors')
            .select('id, full_name, email, phone, services_provided')
            .eq('email', email)
            .single();

        if (error || !data) throw new Error('No matching contractor record found for this account. Contact admin.');

        return {
            id: data.id,
            name: data.full_name || (data.email?.split('@')[0]) || 'Contractor',
            email: data.email,
            phone: data.phone || '',
            services: Array.isArray(data.services_provided) ? data.services_provided.map(String) : [],
        };
    }

    async function fetchAssignmentsForContractor(contractorId) {
        // Only this contractor's assignments, and exclude 'pending' right in the query
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
          category
        )
      `)
            .eq('contractor_id', contractorId)
            .neq('status', 'pending')
            .order('created_at', { ascending: false });

        if (!joined.error && joined.data) {
            return joined.data.map(a => shapeRow(a, a.maintenance_reports || null));
        }

        // Fallback 2-step
        const { data: assigns, error: aErr } = await supabase
            .from('helpdesk_assignments')
            .select('*')
            .eq('contractor_id', contractorId)
            .neq('status', 'pending')
            .order('created_at', { ascending: false });
        if (aErr) throw aErr;

        const reportIds = Array.from(new Set((assigns || []).map(r => r.report_id).filter(Boolean)));
        let reportMap = {};
        if (reportIds.length) {
            const { data: reports, error: rErr } = await supabase
                .from('maintenance_reports')
                .select('id, title, description, property_id, created_at, urgency, category')
                .in('id', reportIds);
            if (!rErr && reports) {
                reportMap = Object.fromEntries(reports.map(r => [r.id, r]));
            }
        }
        return (assigns || []).map(a => shapeRow(a, reportMap[a.report_id]));
    }

    function shapeRow(a, report) {
        const title = report?.title ?? a.title ?? `Ticket #${a.report_id || a.id}`;
        const description = report?.description ?? a.description ?? '';
        const property_id = report?.property_id ?? a.property_id ?? null;
        const created_at = report?.created_at ?? a.created_at;
        const urgency = (report?.urgency || a.urgency || 'medium').toString();
        const category = (report?.category || a.category || '').toString();

        return {
            id: a.id,
            report_id: a.report_id ?? null,
            status: a.status ?? 'assigned',
            assigned_at: a.assigned_at ?? null,
            response_at: a.response_at ?? null,
            created_at,

            title, description, property_id, urgency, category,
            _raw: a, _report: report || null,
        };
    }

    async function refresh() {
        if (!contractor) return;
        setRefreshing(true);
        try {
            const data = await fetchAssignmentsForContractor(contractor.id);
            setRows(data);
        } finally {
            setRefreshing(false);
        }
    }

    async function respondToAssignment(item, response, notes = '') {
        if (!contractor) return;
        setActionBusyId(item.id);
        try {
            // Only allow decisions on 'assigned'
            if (item.status !== 'assigned') {
                setActionBusyId(null);
                return;
            }

            // 1) record response
            const { error: rErr } = await supabase
                .from('contractor_responses')
                .insert({
                    assignment_id: item.id,
                    contractor_id: contractor.id,
                    response, // 'accepted' | 'rejected'
                    notes: notes || null,
                });
            if (rErr) throw rErr;

            // 2) update assignment status + response time
            const { error: aErr } = await supabase
                .from('helpdesk_assignments')
                .update({
                    status: response,
                    response_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', item.id);
            if (aErr) throw aErr;

            setRows(prev => prev.map(r => r.id === item.id ? { ...r, status: response, response_at: new Date().toISOString() } : r));
        } catch (e) {
            console.error(e);
            alert(e.message || 'Failed to submit response.');
        } finally {
            setActionBusyId(null);
        }
    }

    function openReportModal(item) {
        setSelected(item);
        setReportText('');
        setReportModalOpen(true);
    }
    function closeReportModal() {
        setReportModalOpen(false);
        setSelected(null);
        setReportText('');
    }

    async function submitFinalReport() {
        if (!selected || !contractor) return;
        if (!reportText.trim()) {
            alert('Please write a brief final report.');
            return;
        }
        setSubmittingReport(true);
        try {
            // only from 'accepted'
            if (selected.status !== 'accepted') {
                setSubmittingReport(false);
                return;
            }

            // 1) final report
            const { error: cfrErr } = await supabase
                .from('contractor_final_reports')
                .insert({
                    assignment_id: selected.id,
                    contractor_id: contractor.id,
                    report_text: reportText.trim(),
                });
            if (cfrErr) throw cfrErr;

            // 2) mark completed
            const { error: updErr } = await supabase
                .from('helpdesk_assignments')
                .update({
                    status: 'completed',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', selected.id);
            if (updErr) throw updErr;

            setRows(prev => prev.map(r => r.id === selected.id ? { ...r, status: 'completed' } : r));
            closeReportModal();
        } catch (e) {
            console.error(e);
            alert(e.message || 'Failed to submit final report.');
        } finally {
            setSubmittingReport(false);
        }
    }

    // Client-side filters (no "pending")
    const filtered = useMemo(() => {
        let list = rows;
        if (filterStatus === 'open') {
            list = list.filter(r => r.status === 'assigned' || r.status === 'accepted');
        } else if (filterStatus !== 'all') {
            list = list.filter(r => r.status === filterStatus);
        }
        if (q.trim()) {
            const t = q.toLowerCase();
            list = list.filter(r =>
                (r.title || '').toLowerCase().includes(t) ||
                (r.description || '').toLowerCase().includes(t) ||
                (r.category || '').toLowerCase().includes(t)
            );
        }
        return list;
    }, [rows, filterStatus, q]);

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <header className="border-b border-white/10">
                <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <HardHat className="h-6 w-6" />
                        <h1 className="text-xl font-semibold">Contractor Dashboard</h1>
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
                {!contractor ? (
                    loading ? (
                        <div className="grid place-items-center py-20 text-slate-300">
                            <div className="h-10 w-10 border-2 border-slate-600 border-t-white rounded-full animate-spin" />
                            <p className="mt-3">Resolving contractor account…</p>
                        </div>
                    ) : (
                        <div className="grid place-items-center py-20 text-red-300">
                            <p>Contractor record not found for this account. Contact admin.</p>
                        </div>
                    )
                ) : (
                    <>
                        {/* Filters */}
                        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-slate-300">Status</label>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm"
                                >
                                    <option value="open">Open (Assigned/Accepted)</option>
                                    <option value="assigned">Assigned</option>
                                    <option value="accepted">Accepted</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="completed">Completed</option>
                                    <option value="all">All</option>
                                </select>
                            </div>

                            <div className="relative flex-1">
                                <input
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Search title, description, or category…"
                                    className="w-full bg-white/10 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-slate-400"
                                />
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                            </div>

                            <div className="text-xs text-slate-400">
                                Services: {contractor.services.length ? contractor.services.join(', ') : '—'}
                            </div>
                        </div>

                        {/* Content */}
                        {loading ? (
                            <div className="grid place-items-center py-20 text-slate-300">
                                <div className="h-10 w-10 border-2 border-slate-600 border-t-white rounded-full animate-spin" />
                                <p className="mt-3">Loading assignments…</p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="grid place-items-center py-20 text-slate-300">
                                <p>No assignments found.</p>
                            </div>
                        ) : (
                            <ul className="grid md:grid-cols-2 gap-4">
                                {filtered.map(item => {
                                    const canAccept = item.status === 'assigned';
                                    const canReject = item.status === 'assigned';
                                    const canComplete = item.status === 'accepted';

                                    return (
                                        <li key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="text-lg font-semibold">{item.title}</h3>
                                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                                                        <Badge status={item.status} />
                                                        <span className="opacity-60">•</span>
                                                        <span>Urgency: <span className="uppercase tracking-wide">{item.urgency}</span></span>
                                                        {item.category && (
                                                            <>
                                                                <span className="opacity-60">•</span>
                                                                <span>Category: {item.category}</span>
                                                            </>
                                                        )}
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
                                            </div>

                                            {item.description && (
                                                <p className="mt-3 text-sm text-slate-200 whitespace-pre-wrap">
                                                    {item.description}
                                                </p>
                                            )}

                                            <div className="mt-4 flex flex-wrap items-center gap-2">
                                                <button
                                                    disabled={!canAccept || actionBusyId === item.id}
                                                    onClick={() => respondToAssignment(item, 'accepted')}
                                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${canAccept ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-900/50 cursor-not-allowed'}`}
                                                >
                                                    {actionBusyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                    Accept
                                                </button>

                                                <button
                                                    disabled={!canReject || actionBusyId === item.id}
                                                    onClick={() => respondToAssignment(item, 'rejected')}
                                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${canReject ? 'bg-red-600 hover:bg-red-700' : 'bg-red-900/50 cursor-not-allowed'}`}
                                                >
                                                    {actionBusyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                                    Reject
                                                </button>

                                                <button
                                                    disabled={!canComplete}
                                                    onClick={() => openReportModal(item)}
                                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${canComplete ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-900/50 cursor-not-allowed'}`}
                                                >
                                                    <ClipboardCheck className="h-4 w-4" />
                                                    Submit Final Report
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </>
                )}
            </main>

            {/* Final report modal */}
            {reportModalOpen && selected && (
                <div className="fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/60" onClick={closeReportModal} />
                    <div className="absolute inset-0 grid place-items-center p-4">
                        <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-white/10 p-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Final Report
                                </h2>
                                <button onClick={closeReportModal} className="p-1 rounded hover:bg-white/10">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="mt-4 text-sm text-slate-300">
                                Assignment: <span className="text-white font-medium">{selected.title}</span>
                            </div>

                            <label className="mt-4 block text-sm">
                                <span className="text-slate-300">Report details</span>
                                <textarea
                                    className="mt-1 w-full min-h-[140px] bg-white/10 border border-white/10 rounded-lg p-3 text-sm"
                                    value={reportText}
                                    onChange={(e) => setReportText(e.target.value)}
                                    placeholder="Describe the work performed, parts used, time on site, etc."
                                />
                            </label>

                            <div className="mt-6 flex items-center justify-end gap-3">
                                <button onClick={closeReportModal} className="px-4 py-2 rounded-lg border border-white/10">
                                    Cancel
                                </button>
                                <button
                                    onClick={submitFinalReport}
                                    disabled={submittingReport || !reportText.trim()}
                                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-2"
                                >
                                    {submittingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                    Submit & Complete
                                </button>
                            </div>

                            <p className="mt-3 text-xs text-slate-400">
                                Submitting will create a contractor final report and mark the assignment as completed.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
