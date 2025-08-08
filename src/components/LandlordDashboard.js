import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Home, AlertCircle, ClipboardList, X } from 'lucide-react';

const statusLabels = {
  pending: { label: 'Pending', color: 'bg-yellow-600' },
  working: { label: 'Working', color: 'bg-blue-500' },
  fixed: { label: 'Fixed', color: 'bg-green-600' },
  approved: { label: 'Approved', color: 'bg-green-600' },
  rejected: { label: 'Rejected', color: 'bg-red-600' },
};

const LandlordDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [properties, setProperties] = useState([]);
  const [reports, setReports] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalReport, setModalReport] = useState(null);
  const [modalTenant, setModalTenant] = useState(null);
  const [modalAttachments, setModalAttachments] = useState([]);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [landlordConfig, setLandlordConfig] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session) {
        navigate('/login');
        return;
      }

      const currentUser = session.user;
      setUser(currentUser);

      const { data: landlordConf, error: landlordErr } = await supabase
        .from('landlords')
        .select('subscription_tier, maintenance_email')
        .eq('profile_id', currentUser.id)
        .single();

      if (landlordErr) {
        console.error('Failed to fetch landlord config:', landlordErr);
      } else {
        setLandlordConfig(landlordConf);
      }

      const { data: landlordProps, error: propError } = await supabase
        .from('properties')
        .select('*')
        .eq('owner_id', currentUser.id);

      if (propError) {
        console.error('Error fetching properties:', propError.message);
        setLoading(false);
        return;
      }
      setProperties(landlordProps);

      const allReports = {};
      for (const prop of landlordProps) {
        const { data: propReports, error: reportError } = await supabase
          .from('maintenance_reports')
          .select('*, attachments(*)')
          .eq('property_id', prop.id);

        if (reportError) {
          console.error('Error fetching reports for property', prop.id, reportError);
          allReports[prop.id] = [];
          continue;
        }

        if (!propReports.length) {
          allReports[prop.id] = [];
          continue;
        }

        const tenantIds = [...new Set(propReports.map((r) => r.created_by))];
        const { data: tenantProfiles, error: tenantError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', tenantIds);

        if (tenantError) {
          console.error('Error fetching tenant profiles', tenantError);
        }

        const tenantMap = {};
        (tenantProfiles || []).forEach((tp) => {
          tenantMap[tp.id] = tp;
        });

        const reportsWithTenant = propReports.map((r) => ({
          ...r,
          tenantProfile: tenantMap[r.created_by] || null,
        }));

        reportsWithTenant.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        allReports[prop.id] = reportsWithTenant;
      }

      setReports(allReports);
      setLoading(false);
    };

    fetchUserData();
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

    let webhookUrl = '';

    if (landlordConfig.subscription_tier === 'premium') {
      webhookUrl =
        actionType === 'approve'
          ? process.env.REACT_APP_N8N_LANDLORD_APPROVAL_WEBHOOK
          : process.env.REACT_APP_N8N_LANDLORD_REJECTION_WEBHOOK_PREMIUM;
    } else {
      webhookUrl =
        actionType === 'approve'
          ? process.env.REACT_APP_N8N_LANDLORD_BASIC_APPROVAL_WEBHOOK
          : process.env.REACT_APP_N8N_LANDLORD_BASIC_REJECTION_WEBHOOK;
    }

    console.log(`Triggering ${actionType} webhook at:`, webhookUrl);
    console.log('Payload:', payload);

    if (!webhookUrl) {
      console.warn(`Webhook URL for ${actionType} not configured.`);
      return;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook call failed with status ${response.status}`);
    }
  };

  const handleStatusUpdate = async () => {
    if (!landlordConfig) {
      alert('Landlord configuration is loading. Please wait.');
      setStatusUpdating(false);
      return;
    }

    if (!modalReport) {
      console.log('No report selected for approval.');
      return;
    }

    setStatusUpdating(true);
    console.log('Starting approval for report id:', modalReport.id);

    try {
      const { error } = await supabase
        .from('maintenance_reports')
        .update({ status: 'approved' })
        .eq('id', modalReport.id);

      if (error) {
        console.error('Error updating report status:', error);
        throw error;
      }
      console.log('Report status updated to approved in Supabase.');

      setModalReport({ ...modalReport, status: 'approved' });
      setReports((prev) => {
        const updated = { ...prev };
        for (const propId in updated) {
          updated[propId] = updated[propId].map((r) =>
            r.id === modalReport.id ? { ...r, status: 'approved' } : r
          );
        }
        return updated;
      });
      console.log('Local state updated with approved status.');

      const property = properties.find((p) => p.id === modalReport.property_id);
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
      console.log('Approval webhook triggered.');
    } catch (e) {
      console.error('Failed to update status:', e);
      alert('Failed to update status: ' + e.message);
    } finally {
      setStatusUpdating(false);
      console.log('Approval process completed.');
    }
  };

  const handleStatusReject = async () => {
    if (!landlordConfig) {
      alert('Landlord configuration is loading. Please wait.');
      setStatusUpdating(false);
      return;
    }

    if (!modalReport) {
      console.log('No report selected for rejection.');
      return;
    }

    if (modalReport.status === 'approved') {
      alert("You can't reject an approved report.");
      setStatusUpdating(false);
      return;
    }

    setStatusUpdating(true);
    console.log('Starting rejection for report id:', modalReport.id);

    try {
      const { error } = await supabase
        .from('maintenance_reports')
        .update({ status: 'rejected' })
        .eq('id', modalReport.id);

      if (error) {
        console.error('Error updating report status:', error);
        throw error;
      }
      console.log('Report status updated to rejected in Supabase.');

      setModalReport({ ...modalReport, status: 'rejected' });
      setReports((prev) => {
        const updated = { ...prev };
        for (const propId in updated) {
          updated[propId] = updated[propId].map((r) =>
            r.id === modalReport.id ? { ...r, status: 'rejected' } : r
          );
        }
        return updated;
      });
      console.log('Local state updated with rejected status.');

      const property = properties.find((p) => p.id === modalReport.property_id);
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
      console.log('Rejection webhook triggered.');
    } catch (e) {
      console.error('Failed to update status:', e);
      alert('Failed to update status: ' + e.message);
    } finally {
      setStatusUpdating(false);
      console.log('Rejection process completed.');
    }
  };

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
        properties.map((property) => (
          <div key={property.id} className="mb-6 bg-white/10 border border-white/20 rounded-lg">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <Home className="text-blue-400 mr-2" />
                <h2 className="text-2xl font-semibold">{property.name}</h2>
              </div>
              <p className="text-gray-300 mb-4">{property.address}</p>

              {reports[property.id]?.length > 0 ? (
                <ul className="space-y-3">
                  {reports[property.id].map((report) => (
                    <li
                      key={report.id}
                      className="p-4 rounded-lg bg-slate-700 border border-slate-500 hover:shadow-lg transition cursor-pointer"
                      onClick={() => openModal(report)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-lg font-semibold">{report.category || report.title}</p>
                          <p className="text-sm text-gray-400">
                            Tenant: {report.tenantProfile?.full_name || 'Unknown Tenant'}
                          </p>
                          <p className="text-sm text-gray-400">{report.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(report.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div
                          className={`text-sm px-3 py-1 rounded-full ${
                            statusLabels[report.status]?.color || 'bg-gray-500'
                          } text-white`}
                        >
                          {statusLabels[report.status]?.label || report.status}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center gap-2 text-gray-400">
                  <AlertCircle className="w-5 h-5" />
                  <p>No reports submitted for this property.</p>
                </div>
              )}
            </div>
          </div>
        ))
      )}

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
                  className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    statusLabels[modalReport.status]?.color || 'bg-gray-500'
                  } text-white`}
                >
                  {statusLabels[modalReport.status]?.label || modalReport.status}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(modalReport.created_at).toLocaleString()}
                </span>
              </div>
              <div className="text-gray-700 mb-2">{modalReport.description}</div>
              <div className="mb-2">
                <strong>Location:</strong> {modalReport.location || '-'}
              </div>
              <div className="mb-2">
                <strong>Urgency:</strong> {modalReport.urgency || '-'}
              </div>
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

// Helper components and getSignedUrl remain unchanged

function AttachmentImage({ att }) {
  const [url, setUrl] = React.useState('');
  React.useEffect(() => {
    (async () => {
      const signed = await getSignedUrl(att);
      setUrl(signed);
    })();
  }, [att]);
  if (!url) return <div className="w-28 h-28 bg-gray-100 rounded" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img
        src={url}
        alt={att.file_name}
        className="w-28 h-28 object-cover rounded"
        onError={(e) => {
          e.target.src = 'https://via.placeholder.com/112';
        }}
      />
      <div className="text-xs mt-1 text-center">{att.file_name}</div>
    </a>
  );
}

function AttachmentVideo({ att }) {
  const [url, setUrl] = React.useState('');
  React.useEffect(() => {
    (async () => {
      const signed = await getSignedUrl(att);
      setUrl(signed);
    })();
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
