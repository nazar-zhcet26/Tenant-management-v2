// src/components/LandingPage.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Shield, Zap, Star } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();

  const handleChoose = (role) => {
    navigate(`/login?role=${role}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="py-16 text-center text-white">
        <div className="inline-flex items-center justify-center p-4 bg-white rounded-full shadow-lg mb-4">
          <Home className="h-10 w-10 text-gray-800" />
        </div>
        <h1 className="text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-2">
          PropertyCare
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Report maintenance issues with style and get instant responses
        </p>
        <div className="flex justify-center space-x-8">
          <div className="flex items-center space-x-2 text-green-400">
            <Shield className="w-5 h-5" />
            <span>Secure & Private</span>
          </div>
          <div className="flex items-center space-x-2 text-blue-400">
            <Zap className="w-5 h-5" />
            <span>Instant Notifications</span>
          </div>
          <div className="flex items-center space-x-2 text-purple-400">
            <Star className="w-5 h-5" />
            <span>24/7 Support</span>
          </div>
        </div>
      </header>

      {/* Role Selection */}
      <main className="flex-grow flex flex-col items-center justify-center px-4">
        <img
          src="/logo.png"
          alt="Freedom Facilities Logo"
          className="w-45 h-45 mb-6 rounded-full shadow-lg"
        />
        <p className="text-lg text-purple-200 mb-12">
          Welcome to Property Management Service by Freedom Facilities
        </p>

        <div className="flex flex-col sm:flex-row gap-6">
          <button
            onClick={() => handleChoose('tenant')}
            className="px-10 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg transform hover:scale-105"
          >
            I am a Tenant
          </button>
          <button
            onClick={() => handleChoose('landlord')}
            className="px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg transform hover:scale-105"
          >
            I am a Landlord
          </button>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
