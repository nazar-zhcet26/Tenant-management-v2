// src/components/CheckYourEmail.js
import React from 'react';
import { Link } from 'react-router-dom';

export default function CheckYourEmail() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl border border-white/20 text-center space-y-4 max-w-sm w-full">
        <h2 className="text-2xl font-semibold text-white">Almost There!</h2>
        <p className="text-gray-200">
          We’ve sent a confirmation link to your email.<br/>
          Click it to finish setting up your account.
        </p>
        <Link
          to="/login"
          className="inline-block mt-4 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition"
        >
          Return to Login
        </Link>
      </div>
    </div>
  );
}

