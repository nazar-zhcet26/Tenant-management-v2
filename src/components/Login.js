// src/components/Login.js
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Manual auth fallback: if supabase-js signIn promise is slow to settle,
 * call Auth endpoint directly and then setSession().
 */
async function manualAuth(email, password) {
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.error_description || data?.message || `Auth error ${res.status}`
    );
  }
  // Force the session into the SDK
  const { error } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (error) throw error;
  return data;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Only these 2 roles are allowed here
  const roleFromQuery = useMemo(() => {
    const r = (searchParams.get('role') || 'tenant').toLowerCase();
    return r === 'tenant' || r === 'landlord' ? r : 'tenant';
  }, [searchParams]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);

    try {
      // Start normal sign-in, but don’t rely on it to resolve on time
      const signInP = supabase.auth.signInWithPassword({ email, password });
      let settled = false;
      let signInErr = null;
      signInP.then(({ error }) => { settled = true; signInErr = error || null; })
             .catch((e) => { settled = true; signInErr = e; });

      // Poll for a session while sign-in is in flight
      let session = null;
      for (let i = 0; i < 24; i++) { // ~6s
        const { data } = await supabase.auth.getSession();
        session = data?.session || null;
        if (session) break;
        if (settled && signInErr) break;
        await sleep(250);
      }

      // If SDK already failed, surface it
      if (settled && signInErr) {
        throw (signInErr instanceof Error
          ? signInErr
          : new Error(signInErr?.message || 'Login failed'));
      }

      // Still no session? brief grace, then manual token fallback
      if (!session) {
        await Promise.race([signInP, sleep(1500)]);
        const again = await supabase.auth.getSession();
        session = again?.data?.session || null;

        if (!session) {
          await manualAuth(email, password);
          const after = await supabase.auth.getSession();
          session = after?.data?.session || null;
        }
      }

      if (!session) throw new Error('Login did not complete. Please try again.');

      // ✅ Route using the JWT’s user_metadata.role — no DB calls here
      const metaRole = String(
        session.user?.user_metadata?.role || ''
      ).toLowerCase();

      if (metaRole === 'tenant') {
        // optional: guard that this page is tenant-only if URL says landlord
        if (roleFromQuery === 'landlord') {
          await supabase.auth.signOut();
          throw new Error('This account is a Tenant. Open the landlord login.');
        }
        navigate('/report', { replace: true });
        return;
      }

      if (metaRole === 'landlord') {
        if (roleFromQuery === 'tenant') {
          await supabase.auth.signOut();
          throw new Error('This account is a Landlord. Open the tenant login.');
        }
        navigate('/dashboard', { replace: true });
        return;
      }

      // If metadata doesn’t have a role, we can default based on URL
      if (roleFromQuery === 'tenant') {
        navigate('/report', { replace: true });
        return;
      }
      if (roleFromQuery === 'landlord') {
        navigate('/dashboard', { replace: true });
        return;
      }

      // Anything else is not allowed on this page
      await supabase.auth.signOut();
      throw new Error('Unsupported account for this login page.');
    } catch (e) {
      console.error('[login]', e);
      setErr(e.message || 'Unexpected error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-900 to-fuchsia-900 p-6">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm space-y-4 bg-white/10 rounded-2xl p-6 border border-white/20"
      >
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
            Need an account?{' '}
            <a href="/signup?role=tenant" className="underline">
              Sign up
            </a>
          </div>
        )}
      </form>
    </div>
  );
}
