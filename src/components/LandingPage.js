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
          Welcome to PropertyCare
        </h1>
        <p className="text-lg mt-2 text-purple-200">
          Property Management by Freedom Facilities
        </p>
      </div>

      <button
        onClick={() => navigate('/login')}
        className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg transition-transform transform hover:scale-105 shadow-lg shadow-blue-500/25"
      >
        Continue
      </button>
    </div>
  );
};

export default LandingPage;
