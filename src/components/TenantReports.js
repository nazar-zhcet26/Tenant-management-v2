import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { AlertCircle, Camera, FileImage, FileVideo, X, Calendar, MapPin, Home } from 'lucide-react';

const categories = [
    { id: 'plumbing', name: 'Plumbing', icon: '🚿' },
    { id: 'electrical', name: 'Electrical', icon: '⚡' },
    { id: 'hvac', name: 'HVAC', icon: '❄️' },
    { id: 'appliances', name: 'Appliances', icon: '🏠' },
    { id: 'structural', name: 'Structural', icon: '🏗️' },
    { id: 'pest', name: 'Pest Control', icon: '🐛' },
    { id: 'security', name: 'Locks/Security', icon: '🔒' },
    { id: 'windows', name: 'Windows/Doors', icon: '🚪' },
    { id: 'flooring', name: 'Flooring', icon: '🏠' },
    { id: 'other', name: 'Other', icon: '🔧' }
];

const statusLabels = {
    pending: { label: 'Pending', color: 'bg-yellow-600' },
    working: { label: 'Working', color: 'bg-blue-500' },
    fixed: { label: 'Fixed', color: 'bg-green-600' }
};

const urgencyLabels = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    emergency: 'Emergency'
};

function getCategory(catId) {
    return categories.find(c => c.id === catId) || { name: catId, icon: '❓' };
}

function getStatus(status) {
    return statusLabels[status] || { label: status, color: 'bg-gray-500' };
}

const TenantReports = () => {
    const [user, setUser] = useState(null);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [modalReport, setModalReport] = useState(null);

    useEffect(() => {
        const fetchReports = async () => {
            setLoading(true);
            const {
                data: { session },
                error
            } = await supabase.auth.getSession();
            if (error || !session) {
                setUser(null);
                setLoading(false);
                return;
            }
            setUser(session.user);

            // Get reports where created_by = user.id, including attachments & property
            const { data: myReports, error: repErr } = await supabase
                .from('maintenance_reports')
                .select('*, attachments(*), properties(name, address)')
                .eq('created_by', session.user.id)
                .order('created_at', { ascending: false });

            if (repErr) {
                setReports([]);
                setLoading(false);
                return;
            }
            setReports(myReports);
            setLoading(false);
        };

        fetchReports();
    }, []);

   // Helper to get signed URL for attachment
async function getSignedUrl(att) {
  if (att.url && att.url.includes("token=")) return att.url;
  if (att.file_path) {
    const { data, error } = await supabase
      .storage
      .from('maintenance-files')
      .createSignedUrl(att.file_path, 60 * 60); // valid for 1 hour
    return data?.signedUrl || '';
  }
  return '';
}

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white px-4 py-10">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
                <Camera className="h-8 w-8" />
                My Maintenance Reports
            </h1>
            {loading ? (
                <div className="flex items-center justify-center min-h-[200px]">
                    <span className="animate-spin mr-2 h-6 w-6 border-b-2 border-white rounded-full"></span>
                    Loading your reports...
                </div>
            ) : reports.length === 0 ? (
                <div className="bg-white/10 rounded-xl p-12 flex flex-col items-center">
                    <AlertCircle className="h-16 w-16 text-gray-400 mb-6" />
                    <h2 className="text-2xl font-semibold mb-2">No Reports Found</h2>
                    <p className="text-gray-300 mb-4">You haven't submitted any maintenance requests yet.</p>
                </div>
            ) : (
                <div className="space-y-6 max-w-2xl mx-auto">
                    {reports.map(report => {
                        const category = getCategory(report.category);
                        const status = getStatus(report.status);
                        return (
                            <div
                                key={report.id}
                                className="bg-white/10 border border-white/20 rounded-xl shadow-md p-6 hover:shadow-xl transition cursor-pointer"
                                onClick={() => { setShowModal(true); setModalReport(report); }}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">{category.icon}</span>
                                            <span className="text-lg font-semibold">{report.title}</span>
                                            <span className={`ml-2 px-3 py-1 rounded-full text-xs font-semibold ${status.color}`}>
                                                {status.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-400">
                                            <span><Home className="inline h-4 w-4 mr-1" />{report.properties?.name}</span>
                                            {report.location && (
                                                <span><MapPin className="inline h-4 w-4 mr-1" />{report.location}</span>
                                            )}
                                            <span><Calendar className="inline h-4 w-4 mr-1" />{new Date(report.created_at).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className="text-sm text-gray-300">
                                            {report.attachments?.length || 0} attachment{report.attachments?.length === 1 ? '' : 's'}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-gray-200 mt-2">{report.description}</div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal for full report details */}
            {showModal && modalReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
                    <div className="relative bg-white text-gray-900 rounded-xl shadow-2xl p-8 max-w-lg w-full">
                        <button
                            className="absolute top-4 right-4 text-gray-400 hover:text-red-600"
                            onClick={() => setShowModal(false)}
                            aria-label="Close"
                        >
                            <X className="h-7 w-7" />
                        </button>
                        <h2 className="text-2xl font-bold mb-2">{modalReport.title}</h2>
                        <div className="flex gap-2 items-center mb-2">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatus(modalReport.status).color}`}>
                                {getStatus(modalReport.status).label}
                            </span>
                            <span className="text-xs text-gray-500">{new Date(modalReport.created_at).toLocaleString()}</span>
                        </div>
                        <div className="text-gray-700 mb-2">{modalReport.description}</div>
                        <div className="mb-2"><strong>Location:</strong> {modalReport.location || '-'}</div>
                        <div className="mb-2"><strong>Urgency:</strong> {urgencyLabels[modalReport.urgency] || modalReport.urgency}</div>
                        <div className="mb-2"><strong>Property:</strong> {modalReport.properties?.name} ({modalReport.properties?.address})</div>
                        <div className="mb-4"><strong>Category:</strong> {getCategory(modalReport.category).name}</div>
                        {/* Attachments */}
                        {/* Attachments */}
{modalReport.attachments && modalReport.attachments.length > 0 && (
  <div className="mb-3">
    <h3 className="font-semibold mb-1">Attachments</h3>
    <div className="flex flex-wrap gap-3">
      {modalReport.attachments.map(att =>
        att.file_type === 'image'
          ? <AttachmentImage key={att.id} att={att} />
          : <AttachmentVideo key={att.id} att={att} />
      )}
    </div>
  </div>
)}

                    </div>
                </div>
            )}
        </div>
    );
};
// Shows image with signed URL
function AttachmentImage({ att }) {
  const [url, setUrl] = React.useState('');
  React.useEffect(() => {
    (async () => {
      const signed = await getSignedUrl(att);
      console.log('Attachment signed URL:', signed);
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
        onError={e => { e.target.src = 'https://via.placeholder.com/112'; }}
      />
      <div className="text-xs mt-1 text-center">{att.file_name}</div>
    </a>
  );
}


// Shows video with signed URL
function AttachmentVideo({ att }) {
  const [url, setUrl] = React.useState('');
  React.useEffect(() => {
    (async () => setUrl(await getSignedUrl(att)))();
  }, [att]);
  if (!url) return <div className="w-28 h-28 bg-gray-100 rounded" />; // Optional: loading placeholder
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <video
        src={url}
        controls
        className="w-28 h-28 object-cover rounded"
      />
      <div className="text-xs mt-1 text-center">{att.file_name}</div>
    </a>
  );
}


export default TenantReports;

