// src/components/Login.js
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Decode JWT payload (no lib needed)
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/**
 * Auth directly against Supabase Auth REST and return the JSON.
 * We will route immediately using the JWT payload (no DB calls).
 */
async function authViaRest(email, password) {
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
  return data; // { access_token, refresh_token, user, ... }
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
      // 1) Authenticate via REST (this is what your Network shows returning 200)
      const data = await authViaRest(email, password);

      // 2) Read role directly from the JWT payload (no /rest/v1 calls)
      const payload = decodeJwtPayload(data.access_token);
      const metaRole = String(
        payload?.user_metadata?.role || payload?.role || ''
      ).toLowerCase();

      // 3) Route immediately by role (UI never waits on SDK)
      if (metaRole === 'tenant' || (!metaRole && roleFromQuery === 'tenant')) {
        navigate('/report', { replace: true });
      } else if (
        metaRole === 'landlord' ||
        (!metaRole && roleFromQuery === 'landlord')
      ) {
        navigate('/dashboard', { replace: true });
      } else {
        throw new Error(
          'This account is not permitted on this login page. Use the correct portal.'
        );
      }

      // 4) In the background, hydrate supabase-js session so the next pages work
      // (don’t block UI if this takes time)
      supabase.auth
        .setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })
        .catch(() => {})
        .then(async () => {
          // tiny confirmation loop (optional, non-blocking)
          for (let i = 0; i < 8; i++) {
            const { data: s } = await supabase.auth.getSession();
            if (s?.session) break;
            await sleep(150);
          }
        });
    } catch (e) {
      console.error('[login]', e);
      setErr(e.message || 'Unexpected error. Please try again.');
    } finally {
      // Always stop the spinner even if navigation already happened
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
