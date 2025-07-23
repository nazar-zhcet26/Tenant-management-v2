// src/components/Signup.js
import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Signup() {
  const { search } = useLocation();
  const role = new URLSearchParams(search).get('role') || 'tenant';
  const navigate = useNavigate();

  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSignup = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setLoading(false);
      return alert(error.message);
    }
    await supabase
      .from('profiles')
      .insert([{ id: data.user.id, email, role }]);
    setLoading(false);
    navigate(role === 'tenant' ? '/report' : '/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-lg">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">
          Sign up as {role.charAt(0).toUpperCase() + role.slice(1)}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-gray-200 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:ring-2 focus:ring-green-400 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-gray-200 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:ring-2 focus:ring-green-400 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            onClick={handleSignup}
            disabled={loading}
            className={`w-full mt-4 py-3 font-semibold rounded-xl transition ${
              loading
                ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-500/25'
            }`}
          >
            {loading ? 'Signing up…' : 'Sign Up'}
          </button>
        </div>

        <p className="mt-6 text-center text-gray-300 text-sm">
          Already have an account?{' '}
          <Link
            to={`/login?role=${role}`}
            className="text-blue-400 hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
