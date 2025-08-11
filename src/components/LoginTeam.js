// src/components/LoginTeam.js
import React, { useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { useNavigate, useLocation } from 'react-router-dom';

export default function LoginTeam() {
  const navigate = useNavigate();
  const location = useLocation();

  // Read ?role=helpdesk|contractor from query string
  const roleFromQuery = useMemo(() => {
    const q = new URLSearchParams(location.search);
    const r = (q.get('role') || '').toLowerCase();
    return r === 'helpdesk' || r === 'contractor' ? r : '';
  }, [location.search]);

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!roleFromQuery) {
      setErrorMsg('Missing role. Please use the Maintenance Portal and choose your team.');
      return;
    }

    setLoading(true);
    try {
      // 1) Authenticate
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError || !loginData?.session?.user?.id) {
        setErrorMsg(loginError?.message || 'Login failed. Check your credentials.');
        setLoading(false);
        return;
      }

      const userId = loginData.session.user.id;

      // 2) Fetch profile role (must already exist; you create it manually)
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profileErr || !profile?.role) {
        await supabase.auth.signOut();
        setErrorMsg('No profile/role found for this account. Contact admin.');
        setLoading(false);
        return;
      }

      // 3) Enforce strict role match
      if (profile.role !== roleFromQuery) {
        await supabase.auth.signOut();
        setErrorMsg(`This account is not a ${roleFromQuery}. Use the correct portal.`);
        setLoading(false);
        return;
      }

      // 4) Route to the correct dashboard (no "-protected" suffix)
      if (roleFromQuery === 'helpdesk') {
        navigate('/helpdesk-dashboard', { replace: true });
      } else {
        navigate('/contractor-dashboard', { replace: true });
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Unexpected error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm space-y-4 bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 shadow-2xl"
      >
        <h1 className="text-xl font-semibold text-white">
          {roleFromQuery
            ? `${roleFromQuery[0].toUpperCase()}${roleFromQuery.slice(1)} Login`
            : 'Maintenance Team Login'}
        </h1>

        {roleFromQuery === '' && (
          <p className="text-sm text-amber-300">
            Tip: Go to the Maintenance Portal and choose Helpdesk or Contractor.
          </p>
        )}

        {errorMsg && <div className="text-sm text-red-400">{errorMsg}</div>}

        <label className="block">
          <span className="text-slate-200 text-sm">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            className="mt-1 w-full px-4 py-3 rounded-lg bg-white/10 text-white placeholder-slate-300 focus:outline-none"
            placeholder="you@example.com"
          />
        </label>

        <label className="block">
          <span className="text-slate-200 text-sm">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="mt-1 w-full px-4 py-3 rounded-lg bg-white/10 text-white placeholder-slate-300 focus:outline-none"
            placeholder="Your password"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 font-semibold rounded-lg transition ${
            loading
              ? 'bg-gray-600 cursor-not-allowed text-white'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
          }`}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <button
          type="button"
          onClick={() => navigate('/maintenance-portal')}
          className="w-full py-3 font-semibold rounded-lg border border-white/20 text-white hover:bg-white/10 transition"
        >
          Back to Maintenance Portal
        </button>
      </form>
    </div>
  );
}
