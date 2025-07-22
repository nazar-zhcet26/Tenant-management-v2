// src/components/LandingPage.js
import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white text-center px-4">
      {/* Logo */}
      <img
        src="/logo.png"
        alt="Company Logo"
        className="w-32 h-32 mb-6 rounded-full shadow-lg"
      />

      {/* Header */}
      <h1 className="text-4xl font-bold mb-2">Welcome to PropertyCare</h1>
      <p className="text-lg mb-8 text-purple-200">
        Property Management Service by Freedom Facilities
      </p>

      {/* Single “Continue” button */}
      <button
        onClick={() => navigate('/login')}
        className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-black font-semibold transition-transform transform hover:scale-105"
      >
        Continue
      </button>
    </div>
  );
};

export default LandingPage;
