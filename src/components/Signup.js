// src/components/Signup.js
import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Signup() {
  const { search } = useLocation();
  const role     = new URLSearchParams(search).get('role') || 'tenant';
  const navigate = useNavigate();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSignup = async () => {
    setLoading(true);

    // 1) Sign up & send magic-link to production login URL
    const { data: signUpData, error: signUpError } = 
      await supabase.auth.signUp(
        { email, password },
        {
          // replace with your actual Vercel domain
          redirectTo: `${window.location.origin}/login?role=${role}`
        }
      );
    if (signUpError) {
      setLoading(false);
      return alert(`Sign-up error: ${signUpError.message}`);
    }

    // 2) Insert profile row
    const userId = signUpData.user.id;
    const { error: profileError } = 
      await supabase
        .from('profiles')
        .insert([{ id: userId, email, full_name: fullName, role }]);

    if (profileError) {
      console.error('Profile insert failed:', profileError);
      setLoading(false);
      return alert(`Profile setup error: ${profileError.message}`);
    }

    setLoading(false);
    // 3) Send user to “check your email” page
    navigate('/check-your-email');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-lg space-y-6">
        <h2 className="text-2xl font-bold text-white text-center">
          Sign up as {role.charAt(0).toUpperCase() + role.slice(1)}
        </h2>

        <input
          type="text"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="Full Name"
          className="w-full px-4 py-3 rounded-xl bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:ring-2 focus:ring-green-400 focus:border-transparent"
        />

        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-4 py-3 rounded-xl bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:ring-2 focus:ring-green-400 focus:border-transparent"
        />

        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full px-4 py-3 rounded-xl bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:ring-2 focus:ring-green-400 focus:border-transparent"
        />

        <button
          onClick={handleSignup}
          disabled={loading}
          className={`w-full py-3 font-semibold rounded-xl transition ${
            loading
              ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
              : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-500/25'
          }`}
        >
          {loading ? 'Signing up…' : 'Sign Up'}
        </button>

        <p className="text-center text-gray-300 text-sm">
          Already have an account?{' '}
          <Link to={`/login?role=${role}`} className="text-blue-400 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
