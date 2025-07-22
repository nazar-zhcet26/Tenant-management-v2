
import React from 'react';
import { useNavigate } from 'react-router-dom';
"import logo from '../assets/logo.png'; // Make sure your logo is placed here
<img src="/logo.png" alt="Company Logo" className="h-12 w-12" />
    
const LandingPage = () => {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white text-center px-4">
            <div className="mb-8 animate-pulse">
                <img src={logo} alt="Company Logo" className="w-24 h-24 mx-auto rounded-full shadow-lg" />
                <h1 className="text-3xl font-bold mt-4">Welcome to Property Management</h1>
                <p className="text-lg mt-2 text-purple-200">by Freedom Facilities</p>
            </div>

            <button
                onClick={() => navigate('/login')}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:scale-105 transition-all duration-300 shadow-lg shadow-blue-500/25"
            >
                Continue
            </button>
        </div>
    );
};

export default LandingPage;

