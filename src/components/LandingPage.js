// src/components/LandingPage.js
import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white text-center px-4">
      <div className="mb-8 animate-pulse">
        <img
          src="/logo.png"
          alt="Company Logo"
          className="w-24 h-24 mx-auto rounded-full shadow-lg"
        />
        <h1 className="text-3xl font-bold mt-4">
          Welcome to Property Management Service
        </h1>
        <p className="text-lg mt-2 text-purple-200">by Freedom Facilities</p>
      </div>

      <div className="flex space-x-4 mt-8">
        <button
          onClick={() => navigate('/login?role=tenant')}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-transform transform hover:scale-105"
        >
          Tenant Login
        </button>
        <button
          onClick={() => navigate('/login?role=landlord')}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold transition-transform transform hover:scale-105"
        >
          Landlord Login
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
