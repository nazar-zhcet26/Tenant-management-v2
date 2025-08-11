import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Home, AlertCircle, ClipboardList, UserCheck, UserX, X } from 'lucide-react';

const sessionUserId = 02e2fbce-0d47-447a-8d1c-e427e6279f46; 


const statusLabels = {
    pending: { label: 'Pending', color: 'bg-yellow-600' },
    assigned: { label: 'Assigned', color: 'bg-blue-500' },
    accepted: { label: 'Accepted', color: 'bg-green-600' },
    rejected: { label: 'Rejected', color: 'bg-red-600' },
    completed: { label: 'Completed', color: 'bg-gray-600' },
};

export default function HelpdeskDashboard() {
    /*return <div className="text-white p-8">Helpdesk Dashboard is working!</div>;*/

    const [assignments, setAssignments] = useState([]);
    const [contractors, setContractors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [assigningContractorId, setAssigningContractorId] = useState(null);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch helpdesk assignments with related info
                const { data: assignmentData, error: assignmentError } = await supabase
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
            landlords:landlord_id (
              subscription_tier,
              maintenance_email
            ),
            properties:maintenance_reports!inner(property_id) (
              name,
              address
            ),
            contractors (
              id,
              full_name,
              email,
              services_provided
            )
          `)
                    .in('status', ['pending', 'assigned', 'accepted', 'rejected'])
                    .order('created_at', { ascending: false });

                if (assignmentError) throw assignmentError;

                // Fetch all contractors
                const { data: contractorData, error: contractorError } = await supabase
                    .from('contractors')
                    .select('*');
                if (contractorError) throw contractorError;

                setAssignments(assignmentData);
                setContractors(contractorData);
            } catch (error) {
                console.error('Error loading data:', error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const openModal = (assignment) => {
        setSelectedAssignment(assignment);
        setAssigningContractorId(assignment.contractor_id || null);
    };

    const closeModal = () => {
        setSelectedAssignment(null);
        setAssigningContractorId(null);
    };

    const assignContractor = async () => {
        if (!selectedAssignment || !assigningContractorId) return;
        setUpdating(true);
        try {
            const { error } = await supabase
                .from('helpdesk_assignments')
                .update({
                    contractor_id: assigningContractorId,
                    status: 'assigned',
                    assigned_at: new Date().toISOString(),
                    reassignment_count: selectedAssignment.reassignment_count + 1 || 1,
                })
                .eq('id', selectedAssignment.id);

            if (error) throw error;

            // Update local state
            setAssignments((prev) =>
                prev.map((a) =>
                    a.id === selectedAssignment.id
                        ? {
                            ...a,
                            contractor_id: assigningContractorId,
                            status: 'assigned',
                            assigned_at: new Date().toISOString(),
                            reassignment_count: selectedAssignment.reassignment_count + 1 || 1,
                        }
                        : a
                )
            );

            alert('Contractor assigned successfully.');
            closeModal();
        } catch (error) {
            alert('Failed to assign contractor: ' + error.message);
        } finally {
            setUpdating(false);
        }
    };

    if (loading) return <div className="p-6 text-white">Loading assignments...</div>;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6">
            <h1 className="text-4xl font-bold mb-6 flex items-center gap-3">
                <ClipboardList className="w-8 h-8" />
                Helpdesk Dashboard
            </h1>

            {assignments.length === 0 ? (
                <div className="flex items-center gap-2 text-gray-400">
                    <AlertCircle className="w-5 h-5" />
                    <p>No assignments found.</p>
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
                                    <p className="text-sm text-gray-400 mt-1">
                                        Tenant ID: {assignment.maintenance_reports.created_by}
                                    </p>
                                </div>
                                <div
                                    className={`px-3 py-1 rounded-full text-white text-sm ${statusLabels[assignment.status]?.color || 'bg-gray-500'
                                        }`}
                                >
                                    {statusLabels[assignment.status]?.label || assignment.status}
                                </div>
                            </div>
                            <div className="mt-2">
                                Assigned Contractor:{' '}
                                {assignment.contractors ? assignment.contractors.full_name : 'Not assigned'}
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
                            <strong>Tenant ID:</strong> {selectedAssignment.maintenance_reports.created_by}
                        </p>
                        {/* TODO: Fetch and display tenant full name and email */}
                        <div className="mt-4">
                            <label className="block mb-1 font-semibold" htmlFor="contractor-select">
                                Assign Contractor
                            </label>
                            <select
                                id="contractor-select"
                                value={assigningContractorId || ''}
                                onChange={(e) => setAssigningContractorId(e.target.value)}
                                className="w-full border border-gray-300 rounded px-3 py-2"
                            >
                                <option value="">-- Select Contractor --</option>
                                {contractors
                                    .filter((c) =>
                                        selectedAssignment.maintenance_reports.category
                                            ? c.services_provided?.includes(selectedAssignment.maintenance_reports.category)
                                            : true
                                    )
                                    .map((contractor) => (
                                        <option key={contractor.id} value={contractor.id}>
                                            {contractor.full_name} ({contractor.email})
                                        </option>
                                    ))}
                            </select>
                            <button
                                onClick={assignContractor}
                                disabled={updating || !assigningContractorId}
                                className="mt-3 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-60"
                            >
                                {updating ? 'Assigning...' : 'Assign Contractor'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}





