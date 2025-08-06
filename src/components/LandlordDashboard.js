import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useUser } from '../hooks/useUser';
import {
    CheckCircle,
    AlertCircle,
    ChevronRight,
    User,
    MapPin,
    Calendar,
    FileImage,
    FileVideo,
} from 'lucide-react';

const LandlordDashboard = () => {
    const { user } = useUser();
    const [properties, setProperties] = useState([]);
    const [reports, setReports] = useState({});
    const [modalOpen, setModalOpen] = useState(false);
    const [modalReport, setModalReport] = useState(null);
    const [modalTenant, setModalTenant] = useState(null);
    const [statusUpdating, setStatusUpdating] = useState(false);

    useEffect(() => {
        fetchPropertiesAndReports();
    }, []);

    const fetchPropertiesAndReports = async () => {
        try {
            const { data: propsData, error: propsError } = await supabase
                .from('properties')
                .select('id, name, address')
                .eq('owner_id', user.id);
            if (propsError) throw propsError;
            setProperties(propsData || []);

            const newReports = {};
            for (const prop of propsData) {
                const { data: repData, error: repError } = await supabase
                    .from('maintenance_reports')
                    .select('*, profiles!maintenance_reports_created_by_fkey(full_name, email), attachments(*)')
                    .eq('property_id', prop.id)
                    .order('created_at', { ascending: false });
                if (repError) throw repError;
                newReports[prop.id] = repData || [];
            }
            setReports(newReports);
        } catch (error) {
            console.error('Error fetching landlord data:', error);
        }
    };

    const openReportModal = async (report) => {
        setModalReport(report);
        setModalOpen(true);
        try {
            const { data: tenantData, error: tenantError } = await supabase
                .from('profiles')
                .select('full_name, email')
                .eq('id', report.created_by)
                .single();
            if (tenantError) throw tenantError;
            setModalTenant(tenantData);
        } catch (error) {
            console.error('Error fetching tenant data:', error);
            setModalTenant(null);
        }
    };

    const closeModal = () => {
        setModalOpen(false);
        setModalReport(null);
        setModalTenant(null);
    };

    const handleStatusUpdate = async () => {
        if (!modalReport) return;
        setStatusUpdating(true);
        try {
            // Update status to 'approved'
            const { error } = await supabase
                .from('maintenance_reports')
                .update({ status: 'approved' })
                .eq('id', modalReport.id);
            if (error) throw error;

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

            // Prepare payload for webhook
            const payload = {
                report_id: modalReport.id,
                tenant_email: modalTenant?.email,
                tenant_name: modalTenant?.full_name,
                landlord_name: user?.user_metadata?.full_name || user?.email || 'Landlord',
                report_title: modalReport.title,
                report_category: modalReport.category,
                report_url: `${window.location.origin}/my-reports`,
            };

            // Call webhook for email notification
            const webhookUrl = process.env.REACT_APP_N8N_LANDLORD_APPROVAL_WEBHOOK;
            if (webhookUrl) {
                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            } else {
                console.warn('Landlord approval webhook URL not configured.');
            }
        } catch (e) {
            alert('Failed to update status: ' + e.message);
        } finally {
            setStatusUpdating(false);
        }
    };

    return (
        <div className="p-8 bg-slate-900 min-h-screen text-white">
            <h1 className="text-4xl font-bold mb-8">Landlord Dashboard</h1>
            {properties.length === 0 ? (
                <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-16 text-center">
                    <AlertCircle className="h-24 w-24 text-gray-400 mx-auto mb-6" />
                    <h3 className="text-3xl font-bold text-white mb-4">No Properties Found</h3>
                    <p className="text-gray-300 text-lg mb-8">
                        You have no properties registered. Please add properties to get started.
                    </p>
                </div>
            ) : (
                properties.map((property) => (
                    <div key={property.id} className="mb-10">
                        <h2 className="text-2xl font-semibold mb-4">{property.name}</h2>
                        <div>
                            {reports[property.id]?.length === 0 ? (
                                <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 text-center">
                                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-300">No maintenance reports yet.</p>
                                </div>
                            ) : (
                                reports[property.id].map((report) => (
                                    <div
                                        key={report.id}
                                        className="bg-gray-800 rounded p-4 mb-4 cursor-pointer hover:bg-gray-700"
                                        onClick={() => openReportModal(report)}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h3 className="font-semibold text-lg">{report.title}</h3>
                                                <p className="text-sm text-gray-300">{report.category}</p>
                                            </div>
                                            <div>
                                                <span
                                                    className={`inline-block px-3 py-1 rounded-full text-sm ${report.status === 'pending'
                                                            ? 'bg-yellow-500 text-yellow-900'
                                                            : report.status === 'approved'
                                                                ? 'bg-green-500 text-green-900'
                                                                : 'bg-gray-500 text-gray-300'
                                                        }`}
                                                >
                                                    {report.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ))
            )}

            {/* Modal */}
            {modalOpen && modalReport && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
                    <div className="bg-gray-900 rounded-lg max-w-xl w-full p-8 relative">
                        <button
                            className="absolute top-4 right-4 text-gray-400 hover:text-white"
                            onClick={closeModal}
                        >
                            Close
                        </button>
                        <h2 className="text-3xl font-bold mb-4">{modalReport.title}</h2>
                        <p className="mb-2">
                            <strong>Category:</strong> {modalReport.category}
                        </p>
                        <p className="mb-2">
                            <strong>Description:</strong> {modalReport.description}
                        </p>
                        <p className="mb-2">
                            <strong>Status:</strong> {modalReport.status}
                        </p>
                        {modalTenant && (
                            <p className="mb-2">
                                <strong>Tenant:</strong> {modalTenant.full_name} ({modalTenant.email})
                            </p>
                        )}
                        <button
                            onClick={handleStatusUpdate}
                            disabled={statusUpdating || modalReport.status === 'approved'}
                            className={`mt-6 px-6 py-3 rounded font-semibold text-white ${modalReport.status === 'approved'
                                    ? 'bg-gray-600 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-700'
                                }`}
                        >
                            {statusUpdating
                                ? 'Updating...'
                                : modalReport.status === 'pending'
                                    ? 'Approve'
                                    : 'Update Status'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LandlordDashboard;
