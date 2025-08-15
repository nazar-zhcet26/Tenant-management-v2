// src/components/LandlordDashboard.js
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Home, AlertCircle, ClipboardList, X, ChevronDown, ChevronRight } from 'lucide-react';

const statusLabels = {
  pending:  { label: 'Pending',  color: 'bg-yellow-600' },
  working:  { label: 'Working',  color: 'bg-blue-500' },
  fixed:    { label: 'Fixed',    color: 'bg-green-600' },
  approved: { label: 'Approved', color: 'bg-emerald-600' },
  rejected: { label: 'Rejected', color: 'bg-red-600' },
};

// --- helpers to compute landlord-facing status from MR + assignment ---
function deriveLandlordStatus(mrStatus, haStatus) {
  if (mrStatus === 'rejected') return 'rejected';
  if (haStatus === 'completed') return 'fixed';
  if (mrStatus === 'approved' && (haStatus === 'accepted' || haStatus === 'review')) return 'working';
  if (mrStatus === 'approved') return 'approved';
  return 'pending';
}

function countByStatus(list) {
  const base = { pending: 0, approved: 0, working: 0, rejected: 0, fixed: 0 };
  for (const r of list || []) {
    base[r._landlordStatus] = (base[r._landlordStatus] || 0) + 1;
  }
  return base;
}

const LandlordDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [properties, setProperties] = useState([]);
  const [reportsByProperty, setReportsByProperty] = useState({}); // { propertyId: [reports...] }
  const [loading, setLoading] = useState(true);
  const [modalReport, setModalReport] = useState(null);
  const [modalTenant, setModalTenant] = useState(null);
  const [modalAttachments, setModalAttachments] = useState([]);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [landlordConfig, setLandlordConfig] = useState(null);
  const [expanded, setExpanded] = useState({}); // propertyId -> bool

  const toggleProp = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // fetch properties + reports
  useEffect(() => {
    (async () => {
      const { data: sessionData, error } = await supabase.auth.getSession();
      if (error || !sessionData?.session) {
        navigate('/login');
        return;
      }
      const currentUser = sessionData.session.user;
      setUser(currentUser);

      const { data: landlordConf } = await supabase
        .from('landlords')
        .select('subscription_tier, maintenance_email')
        .eq('profile_id', currentUser.id)
        .single();
      if (landlordConf) setLandlordConfig(landlordConf);

      // Properties owned by this landlord
      const { data: landlordProps, error: propError } = await supabase
        .from('properties')
        .select('id, name, address')
        .eq('owner_id', currentUser.id);
      if (propError) {
        console.error('Error fetching properties:', propError.message);
        setLoading(false);
        return;
      }
      setProperties(landlordProps || []);

      // For each property, fetch MR + tenant + attachments + helpdesk assignment (joined)
      const nextReports = {};
      for (const prop of landlordProps || []) {
        const { data: propReports, error: reportError } = await supabase
          .from('maintenance_reports')
          .select(`
            id, title, description, category, urgency, status, created_at, property_id, location,
            created_by,
            attachments (*),
            helpdesk_assignments:helpdesk_assignments (
              id, status, contractor_id, assigned_at, response_at, updated_at
            )
          `)
          .eq('property_id', prop.id);

        if (reportError) {
          console.error('Error fetching reports for property', prop.id, reportError);
          nextReports[prop.id] = [];
          continue;
        }

        // Collect tenant profiles for this property's reports
        const tenantIds = [...new Set((propReports || []).map(r => r.created_by).filter(Boolean))];
        let tenantMap = {};
        if (tenantIds.length) {
          const { data: tenantProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', tenantIds);
          for (const t of (tenantProfiles || [])) tenantMap[t.id] = t;
        }

        // Compute derived status and attach tenant
        const enriched = (propReports || []).map(r => {
          const ha = Array.isArray(r.helpdesk_assignments) ? r.helpdesk_assignments[0] : r.helpdesk_assignments; // normally single
          const haStatus = ha?.status || null;
          return {
            ...r,
            tenantProfile: tenantMap[r.created_by] || null,
            _haStatus: haStatus,
            _landlordStatus: deriveLandlordStatus(r.status, haStatus)
          };
        }).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

        nextReports[prop.id] = enriched;
      }

      setReportsByProperty(nextReports);
      setLoading(false);
    })();
  }, [navigate]);

  const openModal = (report) => {
    setModalReport(report);
    setModalTenant(report.tenantProfile);
    setModalAttachments(report.attachments || []);
  };
  const closeModal = () => {
    setModalReport(null);
    setModalTenant(null);
    setModalAttachments([]);
  };

  const triggerWebhook = async (payload, actionType) => {
    if (!landlordConfig) {
      console.warn('No landlord config available for webhook.');
      return;
    }
    const webhookUrl =
      actionType === 'approve'
        ? process.env.REACT_APP_N8N_LANDLORD_APPROVAL_WEBHOOK
        : process.env.REACT_APP_N8N_LANDLORD_REJECTION_WEBHOOK;

    if (!webhookUrl) {
      console.warn(`Webhook URL for ${actionType} not configured.`);
      return;
    }
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error(`Webhook call failed with status ${resp.status}`);
  };

  // approve / reject handlers (update MR + recompute derived status locally)
  const handleStatusUpdate = async () => {
    if (!landlordConfig) {
      alert('Landlord configuration is loading. Please wait.');
      setStatusUpdating(false);
      return;
    }
    if (!modalReport) return;

    setStatusUpdating(true);
    try {
      const { error } = await supabase
        .from('maintenance_reports')
        .update({ status: 'approved' })
        .eq('id', modalReport.id);
      if (error) throw error;

      // Update local state for report + recompute derived status
      setReportsByProperty(prev => {
        const copy = { ...prev };
        for (const pid of Object.keys(copy)) {
          copy[pid] = copy[pid].map(r => {
            if (r.id !== modalReport.id) return r;
            const newMrStatus = 'approved';
            const newDerived = deriveLandlordStatus(newMrStatus, r._haStatus);
            return { ...r, status: newMrStatus, _landlordStatus: newDerived };
          });
        }
        return copy;
      });
      setModalReport(r => r ? { ...r, status: 'approved', _landlordStatus: deriveLandlordStatus('approved', r._haStatus) } : r);

      const property = properties.find(p => p.id === modalReport.property_id);
      const property_name = property ? property.name : 'Unknown Property';
      const payload = {
        report_id: modalReport.id,
        tenant_email: modalTenant?.email,
        tenant_name: modalTenant?.full_name,
        landlord_email: user.email,
        landlord_name: user.user_metadata?.full_name || user.email || 'Landlord',
        maintenance_email: landlordConfig.maintenance_email,
        subscription_tier: landlordConfig.subscription_tier,
        property_name,
        report_title: modalReport.title,
        report_category: modalReport.category,
        report_url: `${window.location.origin}/my-reports`,
      };
      await triggerWebhook(payload, 'approve');
    } catch (e) {
      console.error('Failed to update status:', e);
      alert('Failed to update status: ' + e.message);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleStatusReject = async () => {
    if (!landlordConfig) {
      alert('Landlord configuration is loading. Please wait.');
      setStatusUpdating(false);
      return;
    }
    if (!modalReport) return;

    if (modalReport.status === 'approved') {
      alert("You can't reject an approved report.");
      setStatusUpdating(false);
      return;
    }

    setStatusUpdating(true);
    try {
      const { error } = await supabase
        .from('maintenance_reports')
        .update({ status: 'rejected' })
        .eq('id', modalReport.id);
      if (error) throw error;

      setReportsByProperty(prev => {
        const copy = { ...prev };
        for (const pid of Object.keys(copy)) {
          copy[pid] = copy[pid].map(r => {
            if (r.id !== modalReport.id) return r;
            const newMrStatus = 'rejected';
            return { ...r, status: newMrStatus, _landlordStatus: 'rejected' };
          });
        }
        return copy;
      });
      setModalReport(r => r ? { ...r, status: 'rejected', _landlordStatus: 'rejected' } : r);

      const property = properties.find(p => p.id === modalReport.property_id);
      const property_name = property ? property.name : 'Unknown Property';
      const payload = {
        report_id: modalReport.id,
        tenant_email: modalTenant?.email,
        tenant_name: modalTenant?.full_name,
        landlord_email: user.email,
        landlord_name: user.user_metadata?.full_name || user.email || 'Landlord',
        maintenance_email: landlordConfig.maintenance_email,
        subscription_tier: landlordConfig.subscription_tier,
        property_name,
        report_title: modalReport.title,
        report_category: modalReport.category,
        report_url: `${window.location.origin}/my-reports`,
      };
      await triggerWebhook(payload, 'reject');
    } catch (e) {
      console.error('Failed to update status:', e);
      alert('Failed to update status: ' + e.message);
    } finally {
      setStatusUpdating(false);
    }
  };

  // derived counters per property (memoized)
  const counters = useMemo(() => {
    const map = {};
    for (const p of properties || []) {
      map[p.id] = countByStatus(reportsByProperty[p.id] || []);
    }
    return map;
  }, [properties, reportsByProperty]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6">
      <h1 className="text-4xl font-bold mb-6 flex items-center gap-3">
        <ClipboardList className="w-8 h-8" />
        Landlord Dashboard
      </h1>

      {properties.length === 0 ? (
        <div className="flex items-center gap-2 text-gray-400">
          <AlertCircle className="w-5 h-5" />
          <p>You have not added any properties yet.</p>
        </div>
      ) : (
        properties.map((property) => {
          const list = reportsByProperty[property.id] || [];
          const c = counters[property.id] || { pending: 0, approved: 0, working: 0, rejected: 0, fixed: 0 };
          const hasPending = c.pending > 0;
          const isOpen = !!expanded[property.id];

          return (
            <div key={property.id} className="mb-4 bg-white/10 border border-white/20 rounded-xl overflow-hidden">
              {/* Property summary row */}
              <button
                className="w-full text-left p-5 hover:bg-white/5 transition flex items-center gap-4"
                onClick={() => toggleProp(property.id)}
              >
                <div className="shrink-0">
                  {isOpen ? <ChevronDown className="w-5 h-5 text-white/70" /> : <ChevronRight className="w-5 h-5 text-white/70" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Home className="text-blue-400" />
                    <h2 className="text-xl font-semibold">{property.name}</h2>
                    {hasPending && <span className="inline-block w-2 h-2 rounded-full bg-yellow-400" title="New pending" />}
                  </div>
                  <p className="text-gray-300 text-sm mt-1">{property.address}</p>
                </div>
                {/* Counters */}
                <div className="flex items-center gap-2 flex-wrap">
                  <CounterPill type="Pending" value={c.pending} color={statusLabels.pending.color} />
                  <CounterPill type="Approved" value={c.approved} color={statusLabels.approved.color} />
                  <CounterPill type="Working" value={c.working} color={statusLabels.working.color} />
                  <CounterPill type="Rejected" value={c.rejected} color={statusLabels.rejected.color} />
                  <CounterPill type="Fixed" value={c.fixed} color={statusLabels.fixed.color} />
                </div>
              </button>

              {/* Expanded reports for this property */}
              {isOpen && (
                <div className="px-5 pb-5">
                  {list.length > 0 ? (
                    <ul className="space-y-3">
                      {list.map((report) => (
                        <li
                          key={report.id}
                          className="p-4 rounded-lg bg-slate-700 border border-slate-500 hover:shadow-lg transition cursor-pointer"
                          onClick={() => openModal(report)}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-lg font-semibold">{report.title || report.category}</p>
                              <p className="text-sm text-gray-300">
                                Unit: {report.location || '-'} • Urgency: {report.urgency || '-'} • Category: {report.category || '-'}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(report.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div className={`text-sm px-3 py-1 rounded-full ${statusLabels[report._landlordStatus]?.color || 'bg-gray-500'} text-white`}>
                              {statusLabels[report._landlordStatus]?.label || report._landlordStatus}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-400 p-4">
                      <AlertCircle className="w-5 h-5" />
                      <p>No reports submitted for this property.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Modal stays largely the same; show derived status chip */}
      {modalReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="relative bg-white text-gray-900 rounded-xl shadow-2xl p-8 max-w-2xl w-full">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-red-600"
              onClick={closeModal}
              aria-label="Close"
            >
              <X className="h-7 w-7" />
            </button>
            <div className="mb-3">
              <h2 className="text-2xl font-bold mb-2">{modalReport.title}</h2>
              <div className="flex gap-2 items-center mb-2">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusLabels[modalReport._landlordStatus || modalReport.status]?.color || 'bg-gray-500'} text-white`}
                >
                  {statusLabels[modalReport._landlordStatus || modalReport.status]?.label || modalReport._landlordStatus || modalReport.status}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(modalReport.created_at).toLocaleString()}
                </span>
              </div>
              <div className="text-gray-700 mb-2">{modalReport.description}</div>
              <div className="mb-2"><strong>Location:</strong> {modalReport.location || '-'}</div>
              <div className="mb-2"><strong>Urgency:</strong> {modalReport.urgency || '-'}</div>
              {modalTenant && (
                <div className="mb-2">
                  <strong>Submitted by:</strong> {modalTenant.full_name} ({modalTenant.email})
                </div>
              )}
            </div>

            {modalAttachments.length > 0 && (
              <div className="mb-3">
                <h3 className="font-semibold mb-1">Attachments</h3>
                <div className="flex flex-wrap gap-3">
                  {modalAttachments.map((att) =>
                    att.file_type === 'image' ? (
                      <AttachmentImage key={att.id} att={att} />
                    ) : (
                      <AttachmentVideo key={att.id} att={att} />
                    )
                  )}
                </div>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              {modalReport.status !== 'approved' && (
                <>
                  <button
                    onClick={handleStatusUpdate}
                    disabled={statusUpdating || !landlordConfig}
                    className="px-6 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg transition disabled:opacity-60"
                  >
                    {statusUpdating ? 'Updating...' : 'Approve'}
                  </button>
                  <button
                    onClick={handleStatusReject}
                    disabled={statusUpdating || !landlordConfig}
                    className="px-6 py-2 bg-red-700 hover:bg-red-800 text-white font-semibold rounded-lg transition disabled:opacity-60"
                  >
                    {statusUpdating ? 'Updating...' : 'Reject'}
                  </button>
                </>
              )}
              {modalReport.status === 'approved' && (
                <div className="text-green-600 font-semibold">Report Approved</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandlordDashboard;

/* ------------ helpers: attachments + signed URL (unchanged) ------------- */
function AttachmentImage({ att }) {
  const [url, setUrl] = React.useState('');
  React.useEffect(() => {
    (async () => { setUrl(await getSignedUrl(att)); })();
  }, [att]);
  if (!url) return <div className="w-28 h-28 bg-gray-100 rounded" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img
        src={url}
        alt={att.file_name}
        className="w-28 h-28 object-cover rounded"
        onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/112'; }}
      />
      <div className="text-xs mt-1 text-center">{att.file_name}</div>
    </a>
  );
}
function AttachmentVideo({ att }) {
  const [url, setUrl] = React.useState('');
  React.useEffect(() => {
    (async () => { setUrl(await getSignedUrl(att)); })();
  }, [att]);
  if (!url) return <div className="w-28 h-28 bg-gray-100 rounded" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <video src={url} controls className="w-28 h-28 object-cover rounded" />
      <div className="text-xs mt-1 text-center">{att.file_name}</div>
    </a>
  );
}
async function getSignedUrl(att) {
  if (att.url && att.url.includes('token=')) return att.url;
  if (att.file_path) {
    const { data } = await supabase.storage
      .from('maintenance-files')
      .createSignedUrl(att.file_path, 60 * 60);
    return data?.signedUrl || '';
  }
  return '';
}

/* ---------------- small badge component ---------------- */
function CounterPill({ type, value, color }) {
  return (
    <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${color} text-white`}>
      {type}: {value}
    </div>
  );
}
