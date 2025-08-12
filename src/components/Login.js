// src/components/Login.js
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';

// read envs in either CRA or Vite builds (for the fallback fetch)
const SUPABASE_URL =
  (import.meta?.env && import.meta.env.VITE_SUPABASE_URL) ||
  process.env.REACT_APP_SUPABASE_URL;

const SUPABASE_ANON_KEY =
  (import.meta?.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  process.env.REACT_APP_SUPABASE_ANON_KEY;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // This page is ONLY for tenants & landlords
  const roleFromQuery = useMemo(() => {
    const r = (searchParams.get('role') || 'tenant').toLowerCase();
    return r === 'tenant' || r === 'landlord' ? r : 'tenant';
  }, [searchParams]);

  async function signInFallbackViaFetch(email, password) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Auth configuration missing.');
    }
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      const msg = j?.error_description || j?.message || `Auth error ${res.status}`;
      throw new Error(msg);
    }
    const data = await res.json(); // access_token, refresh_token, user
    const { error } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    if (error) throw error;
    return data;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);

    try {
      // Kick off SDK sign-in but don’t rely on it resolving on time
      const signInP = supabase.auth.signInWithPassword({ email, password });
      let signInSettled = false;
      let signInErr = null;
      signInP
        .then(({ error }) => {
          signInSettled = true;
          signInErr = error || null;
        })
        .catch((e) => {
          signInSettled = true;
          signInErr = e;
        });

      // Poll for a session for ~6s while sign-in runs
      let session = null;
      for (let i = 0; i < 24; i++) {
        const { data } = await supabase.auth.getSession();
        session = data?.session || null;
        if (session) break;
        if (signInSettled && signInErr) break;
        await sleep(250);
      }

      // If SDK already failed, surface it
      if (signInSettled && signInErr) {
        throw (signInErr instanceof Error
          ? signInErr
          : new Error(signInErr?.message || 'Login failed'));
      }

      // Still no session? brief grace, then manual token fallback
      if (!session) {
        await Promise.race([signInP, sleep(1500)]);
        const { data } = await supabase.auth.getSession();
        session = data?.session || null;

        if (!session) {
          await signInFallbackViaFetch(email, password);
          const again = await supabase.auth.getSession();
          session = again?.data?.session || null;
        }
      }

      if (!session) throw new Error('Login did not complete. Please try again.');

      // Fetch or backfill tenant/landlord profile
      const userId = session.user.id;
      const userEmail = session.user.email || email;

      const { data: profile, error: selErr } = await supabase
        .from('profiles')
        .select('id, role, full_name')
        .eq('id', userId)
        .maybeSingle();
      if (selErr) throw selErr;

      let role = profile?.role || null;

      if (!profile) {
        // First login: create a profile, seed role from URL
        const full_name = session.user.user_metadata?.full_name || '';
        const { error: insErr } = await supabase.from('profiles').insert({
          id: userId,
          email: userEmail,
          full_name,
          role: roleFromQuery,
        });
        if (insErr) throw insErr;
        role = roleFromQuery;
      } else if (!role) {
        // Backfill missing role once (don’t overwrite if already set)
        const { error: updErr } = await supabase
          .from('profiles')
          .update({ role: roleFromQuery })
          .eq('id', userId);
        if (updErr) throw updErr;
        role = roleFromQuery;
      }

      // Hard stop: this page is only for tenant/landlord
      if (role !== 'tenant' && role !== 'landlord') {
        await supabase.auth.signOut();
        throw new Error('This account is for the Maintenance Portal. Use the Helpdesk/Contractor login.');
      }

      // Optional UX guard: enforce URL role
      if (roleFromQuery && role !== roleFromQuery) {
        await supabase.auth.signOut();
        throw new Error(`This account is a ${role}. Open the correct login page.`);
      }

      // Route by role
      if (role === 'tenant') navigate('/report', { replace: true });
      else navigate('/dashboard', { replace: true }); // landlord
    } catch (e) {
      console.error('[login]', e);
      setErr(e.message || 'Unexpected error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-900 to-fuchsia-900 p-6">
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 bg-white/10 rounded-2xl p-6 border border-white/20">
        <h1 className="text-xl font-semibold text-white">
          Log in as {roleFromQuery[0].toUpperCase() + roleFromQuery.slice(1)}
        </h1>

        {err && <div className="text-sm text-red-300">{err}</div>}

        <label className="block">
          <span className="text-slate-100 text-sm">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            className="mt-1 w-full px-4 py-3 rounded-lg bg-white/15 text-white placeholder-slate-300 focus:outline-none"
            placeholder="you@example.com"
          />
        </label>

        <label className="block">
          <span className="text-slate-100 text-sm">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="current-password"
            required
            className="mt-1 w-full px-4 py-3 rounded-lg bg-white/15 text-white placeholder-slate-300 focus:outline-none"
            placeholder="••••••••"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 font-semibold rounded-lg transition ${
            loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-white text-purple-900 hover:bg-violet-100'
          }`}
        >
          {loading ? 'Logging in…' : 'Log in'}
        </button>

        {roleFromQuery === 'tenant' && (
          <div className="text-xs text-slate-200">
            Need an account? <a href="/signup?role=tenant" className="underline">Sign up</a>
          </div>
        )}
      </form>
    </div>
  );
}
