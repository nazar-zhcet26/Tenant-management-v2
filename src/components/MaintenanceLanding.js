import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function MaintenanceLanding() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 text-white flex flex-col items-center justify-center p-6">
            <h1 className="text-4xl font-bold mb-12">Welcome to Maintenance Portal</h1>
            <div className="flex flex-col sm:flex-row gap-8">
                <button
                    onClick={() => navigate('/helpdesk-login')}
                    className="bg-blue-600 hover:bg-blue-700 px-10 py-4 rounded-lg text-xl font-semibold shadow-lg transition"
                >
                    Helpdesk Login
                </button>
                <button
                    onClick={() => navigate('/contractor-login')}
                    className="bg-green-600 hover:bg-green-700 px-10 py-4 rounded-lg text-xl font-semibold shadow-lg transition"
                >
                    Contractor Login
                </button>
            </div>
        </div>
    );
}
