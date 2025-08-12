// src/components/Login.js
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function manualAuth(email, password) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Auth configuration missing.');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error_description || data?.message || `Auth error ${res.status}`);

  // force-set session in SDK
  const { error } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (error) throw error;
  return data;
}

// ---- REST helpers (explicit apikey+bearer) ----
async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || '';
}

async function fetchProfileRole(userId) {
  const token = await getAccessToken();
  const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  const rows = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(rows?.message || `Profile query failed (${res.status})`);
  return Array.isArray(rows) && rows.length ? rows[0]?.role || null : null;
}

async function insertProfile({ id, email, full_name, role }) {
  const token = await getAccessToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ id, email, full_name, role }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.message || `Insert profile failed (${res.status})`);
  }
}

async function updateProfileRole(id, role) {
  const token = await getAccessToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.message || `Update profile failed (${res.status})`);
  }
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ONLY tenant | landlord here
  const roleFromQuery = useMemo(() => {
    const r = (searchParams.get('role') || 'tenant').toLowerCase();
    return r === 'tenant' || r === 'landlord' ? r : 'tenant';
  }, [searchParams]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);

    try {
      // 1) SDK sign-in started (don’t rely on it finishing)
      const signInP = supabase.auth.signInWithPassword({ email, password });
      let signInSettled = false;
      let signInErr = null;
      signInP.then(({ error }) => { signInSettled = true; signInErr = error || null; })
             .catch((e) => { signInSettled = true; signInErr = e; });

      // 2) Poll for a session (~6s)
      let session = null;
      for (let i = 0; i < 24; i++) {
        const { data } = await supabase.auth.getSession();
        session = data?.session || null;
        if (session) break;
        if (signInSettled && signInErr) break;
        await sleep(250);
      }

      // 3) If SDK failed, throw; if still no session, do manual fallback
      if (signInSettled && signInErr) {
        throw (signInErr instanceof Error ? signInErr : new Error(signInErr?.message || 'Login failed'));
      }
      if (!session) {
        await Promise.race([signInP, sleep(1500)]);
        const again = await supabase.auth.getSession();
        session = again?.data?.session || null;
        if (!session) {
          await manualAuth(email, password); // sets session
          const after = await supabase.auth.getSession();
          session = after?.data?.session || null;
        }
      }
      if (!session) throw new Error('Login did not complete. Please try again.');

      // 4) Ensure we have a tenant/landlord profile (via REST so apikey is guaranteed)
      const userId = session.user.id;
      const userEmail = session.user.email || email;
      let role = await fetchProfileRole(userId);

      if (!role) {
        // create or backfill role based on the URL (first login)
        const full_name = session.user.user_metadata?.full_name || '';
        try {
          await insertProfile({ id: userId, email: userEmail, full_name, role: roleFromQuery });
          role = roleFromQuery;
        } catch {
          // profile might exist but role empty — try updating
          await updateProfileRole(userId, roleFromQuery);
          role = roleFromQuery;
        }
      }

      // 5) Hard stop: this page is only for tenant/landlord
      if (role !== 'tenant' && role !== 'landlord') {
        await supabase.auth.signOut();
        throw new Error('This account is for the Maintenance Portal. Use the Helpdesk/Contractor login.');
      }

      // Optional: enforce URL role
      if (roleFromQuery && role !== roleFromQuery) {
        await supabase.auth.signOut();
        throw new Error(`This account is a ${role}. Open the correct login page.`);
      }

      // 6) Route
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
