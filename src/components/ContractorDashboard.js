import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { ClipboardList, Check, X, Upload, AlertCircle, User } from 'lucide-react';

const statusLabels = {
    assigned: { label: 'Assigned', color: 'bg-blue-500' },
    accepted: { label: 'Accepted', color: 'bg-green-600' },
    rejected: { label: 'Rejected', color: 'bg-red-600' },
    completed: { label: 'Completed', color: 'bg-gray-600' },
};

export default function ContractorDashboard() {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [acceptingRejecting, setAcceptingRejecting] = useState(false);
    const [submittingReport, setSubmittingReport] = useState(false);
    const [finalReportText, setFinalReportText] = useState('');

    useEffect(() => {
        const fetchAssignments = async () => {
            setLoading(true);
            try {
                const {
                    data: assignmentsData,
                    error,
                } = await supabase
                    .from('helpdesk_assignments')
                    .select(`
            *,
            maintenance_reports (
              title,
              description,
              category,
              created_at,
              created_by,
              attachments (*)
            ),
            properties:maintenance_reports!inner(property_id) (
              name,
              address
            ),
            contractor_final_reports (
              report_text,
              created_at
            )
          `)
                    .in('status', ['assigned', 'accepted'])
                    .eq('contractor_id', supabase.auth.user()?.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setAssignments(assignmentsData);
            } catch (err) {
                console.error('Error fetching assignments:', err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchAssignments();
    }, []);

    const openModal = (assignment) => {
        setSelectedAssignment(assignment);
        setFinalReportText(
            assignment.contractor_final_reports?.report_text || ''
        );
    };

    const closeModal = () => {
        setSelectedAssignment(null);
        setFinalReportText('');
    };

    const respondToAssignment = async (response) => {
        if (!selectedAssignment) return;
        setAcceptingRejecting(true);
        try {
            // Insert contractor response
            const { error: responseError } = await supabase.from('contractor_responses').insert([
                {
                    assignment_id: selectedAssignment.id,
                    contractor_id: supabase.auth.user()?.id,
                    response,
                },
            ]);

            if (responseError) throw responseError;

            // Update assignment status accordingly
            const newStatus = response === 'accepted' ? 'accepted' : 'rejected';
            const { error: assignmentError } = await supabase
                .from('helpdesk_assignments')
                .update({ status: newStatus, response_at: new Date().toISOString() })
                .eq('id', selectedAssignment.id);

            if (assignmentError) throw assignmentError;

            alert(`Assignment ${newStatus}`);
            closeModal();
            // Refresh assignments list
            setAssignments((prev) =>
                prev.map((a) =>
                    a.id === selectedAssignment.id ? { ...a, status: newStatus } : a
                )
            );
        } catch (err) {
            alert('Error responding to assignment: ' + err.message);
        } finally {
            setAcceptingRejecting(false);
        }
    };

    const submitFinalReport = async () => {
        if (!selectedAssignment) return;
        if (!finalReportText.trim()) {
            alert('Please enter the final report text.');
            return;
        }
        setSubmittingReport(true);
        try {
            const { data, error } = await supabase
                .from('contractor_final_reports')
                .upsert([
                    {
                        assignment_id: selectedAssignment.id,
                        contractor_id: supabase.auth.user()?.id,
                        report_text: finalReportText.trim(),
                    },
                ])
                .select();

            if (error) throw error;

            alert('Final report submitted successfully.');
            closeModal();
            // Update local assignments with final report info
            setAssignments((prev) =>
                prev.map((a) =>
                    a.id === selectedAssignment.id
                        ? { ...a, contractor_final_reports: data[0], status: 'completed' }
                        : a
                )
            );
        } catch (err) {
            alert('Error submitting final report: ' + err.message);
        } finally {
            setSubmittingReport(false);
        }
    };

    if (loading) return <div className="p-6 text-white">Loading assignments...</div>;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6">
            <h1 className="text-4xl font-bold mb-6 flex items-center gap-3">
                <ClipboardList className="w-8 h-8" />
                Contractor Dashboard
            </h1>

            {assignments.length === 0 ? (
                <div className="flex items-center gap-2 text-gray-400">
                    <AlertCircle className="w-5 h-5" />
                    <p>No assigned jobs currently.</p>
                </div>
            ) : (
                <ul className="space-y-4">
                    {assignments.map((assignment) => (
                        <li
                            key={assignment.id}
                            className="bg-white/10 p-4 rounded-lg cursor-pointer hover:bg-white/20"
                            onClick={() => openModal(assignment)}
                        >
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-semibold">{assignment.maintenance_reports.title}</h2>
                                    <p className="text-sm text-gray-300">
                                        Property: {assignment.properties?.name || 'Unknown'}
                                    </p>
                                    <p className="text-sm text-gray-300">Category: {assignment.maintenance_reports.category}</p>
                                </div>
                                <div
                                    className={`px-3 py-1 rounded-full text-white text-sm ${statusLabels[assignment.status]?.color || 'bg-gray-500'
                                        }`}
                                >
                                    {statusLabels[assignment.status]?.label || assignment.status}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {/* Modal */}
            {selectedAssignment && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
                    <div className="bg-white text-gray-900 rounded-lg p-6 max-w-lg w-full relative">
                        <button
                            className="absolute top-3 right-3 text-gray-600 hover:text-red-600"
                            onClick={closeModal}
                            aria-label="Close modal"
                        >
                            <X size={24} />
                        </button>

                        <h3 className="text-2xl font-semibold mb-4">
                            {selectedAssignment.maintenance_reports.title}
                        </h3>
                        <p className="mb-2">
                            <strong>Category:</strong> {selectedAssignment.maintenance_reports.category}
                        </p>
                        <p className="mb-2">
                            <strong>Description:</strong> {selectedAssignment.maintenance_reports.description}
                        </p>
                        <p className="mb-2">
                            <strong>Property:</strong> {selectedAssignment.properties?.name}
                        </p>
                        <p className="mb-2">
                            <strong>Status:</strong> {statusLabels[selectedAssignment.status]?.label || selectedAssignment.status}
                        </p>

                        {/* Accept / Reject buttons if status is assigned */}
                        {selectedAssignment.status === 'assigned' && (
                            <div className="flex gap-4 mt-4">
                                <button
                                    disabled={acceptingRejecting}
                                    onClick={() => respondToAssignment('accepted')}
                                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                                >
                                    <Check /> Accept
                                </button>
                                <button
                                    disabled={acceptingRejecting}
                                    onClick={() => respondToAssignment('rejected')}
                                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
                                >
                                    <UserX /> Reject
                                </button>
                            </div>
                        )}

                        {/* Final report textarea and submit button if accepted or completed */}
                        {(selectedAssignment.status === 'accepted' || selectedAssignment.status === 'completed') && (
                            <div className="mt-6">
                                <label className="block font-semibold mb-2" htmlFor="final-report-text">
                                    Final Report
                                </label>
                                <textarea
                                    id="final-report-text"
                                    rows={5}
                                    value={finalReportText}
                                    onChange={(e) => setFinalReportText(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded"
                                />
                                <button
                                    disabled={submittingReport}
                                    onClick={submitFinalReport}
                                    className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded"
                                >
                                    {submittingReport ? 'Submitting...' : 'Submit Final Report'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

