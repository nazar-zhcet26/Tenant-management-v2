// src/components/LoginTeam.js
import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function useRoleFromQuery() {
  const { search } = useLocation();
  const r = (new URLSearchParams(search).get('role') || '').toLowerCase();
  return r === 'helpdesk' || r === 'contractor' ? r : '';
}

// Auth via REST, then hydrate SDK (fast + reliable)
async function authViaRest(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error_description || data?.message || `Auth error ${res.status}`);

  const { error } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (error) throw error;
  return data;
}

async function fetchProfileRole() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const uid = data?.session?.user?.id;
  if (!token || !uid) return null;

  const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}&select=role&apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length ? (rows[0]?.role || null) : null;
}

export default function LoginTeam() {
  const navigate = useNavigate();
  const roleFromQuery = useRoleFromQuery();

  const [email, setEmail] = useState('');
  const [password, setPass] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setErr('');
    if (!roleFromQuery) {
      setErr('Missing role. Open this page from Maintenance Portal.');
      return;
    }
    setLoading(true);

    try {
      // 1) Auth (REST) and hydrate session
      await authViaRest(email, password);

      // 2) Poll briefly for session (race guard)
      let { data } = await supabase.auth.getSession();
      let session = data?.session || null;
      for (let i = 0; !session && i < 12; i++) { // ~3s
        await sleep(250);
        ({ data } = await supabase.auth.getSession());
        session = data?.session || null;
      }
      if (!session) throw new Error('Login did not complete. Please try again.');

      // 3) Fetch role from profiles (admin-provisioned accounts)
      const dbRole = String(await fetchProfileRole() || '').toLowerCase();
      if (!dbRole) throw new Error('No role set on this account. Ask admin to provision it.');
      if (dbRole !== roleFromQuery) {
        await supabase.auth.signOut();
        throw new Error(`This account is a ${dbRole}. Open the correct portal.`);
      }

      // 4) Route
      navigate(dbRole === 'helpdesk' ? '/helpdesk-dashboard' : '/contractor-dashboard', { replace: true });
    } catch (e) {
      console.error('[team login]', e);
      setErr(e.message || 'Unexpected error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 shadow-2xl">
        <h1 className="text-xl font-semibold text-white">
          {roleFromQuery ? `${roleFromQuery[0].toUpperCase()}${roleFromQuery.slice(1)} Login` : 'Maintenance Team Login'}
        </h1>

        {err && <div className="text-sm text-red-400">{err}</div>}

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
            onChange={(e) => setPass(e.target.value)}
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
            loading ? 'bg-gray-600 cursor-not-allowed text-white' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
          }`}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <button
          type="button"
          onClick={() => (window.location.href = '/maintenance-portal')}
          className="w-full py-3 font-semibold rounded-lg border border-white/20 text-white hover:bg-white/10 transition"
        >
          Back to Maintenance Portal
        </button>
      </form>
    </div>
  );
}
