// src/components/Login.js
import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Login() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const role = params.get('role') || 'tenant';
  const navigate = useNavigate();

  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return alert(error.message);
    navigate(role === 'tenant' ? '/report' : '/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-lg">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">
          Log in as {role.charAt(0).toUpperCase() + role.slice(1)}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-gray-200 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-gray-200 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className={`w-full mt-4 py-3 font-semibold rounded-xl transition ${
              loading
                ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-500/25'
            }`}
          >
            {loading ? 'Logging in…' : 'Log In'}
          </button>
        </div>

        <p className="mt-6 text-center text-gray-300 text-sm">
          Don’t have an account?{' '}
          <Link
            to={`/signup?role=${role}`}
            className="text-blue-400 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
