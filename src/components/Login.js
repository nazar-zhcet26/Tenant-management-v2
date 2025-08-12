// src/components/Login.js
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timeout after ${ms}ms`)), ms)),
  ]);
}

export default function Login() {
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const navigate              = useNavigate();
  const [searchParams]        = useSearchParams();

  // Only allow tenant/landlord from the query; default tenant
  const roleFromQuery = useMemo(() => {
    const r = (searchParams.get('role') || 'tenant').toLowerCase();
    return r === 'tenant' || r === 'landlord' ? r : 'tenant';
  }, [searchParams]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);

    try {
      // 1) Sign in (never let this hang forever)
      const { data: loginData, error: loginError } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        10000,
        'signIn'
      );
      if (loginError) throw loginError;

      const user = loginData?.user;
      const userId = user?.id;
      if (!userId) throw new Error('Login failed. Check your credentials.');

      // 2) Ensure session is actually present (race guard)
      await withTimeout(supabase.auth.getSession(), 5000, 'getSession');

      // 3) Read existing profile role (don’t clobber it)
      const { data: got, error: selErr } = await withTimeout(
        supabase.from('profiles').select('id, role, full_name').eq('id', userId).limit(1),
        8000,
        'fetchProfile'
      );
      if (selErr) throw selErr;

      let role = got?.[0]?.role;
      if (!role) {
        // 4) Create profile if missing; use role from query ONLY when no profile exists
        const full_name = user?.user_metadata?.full_name || '';
        const { error: insErr } = await withTimeout(
          supabase.from('profiles').insert({
            id: userId,
            email: user?.email || email,
            full_name,
            role: roleFromQuery, // seed role on first login only
          }),
          8000,
          'insertProfile'
        );
        if (insErr) throw insErr;
        role = roleFromQuery;
      }

      // 5) Route by actual stored role
      if (role === 'tenant') {
        navigate('/report', { replace: true });
      } else if (role === 'landlord') {
        navigate('/dashboard', { replace: true });
      } else if (role === 'helpdesk') {
        navigate('/helpdesk-dashboard', { replace: true });
      } else if (role === 'contractor') {
        navigate('/contractor-dashboard', { replace: true });
      } else {
        // Unknown role → sign out to avoid limbo
        await supabase.auth.signOut();
        throw new Error('Unsupported role on this account. Contact admin.');
      }
    } catch (e) {
      console.error('[login]', e);
      setErr(e.message || 'Unexpected error. Please try again.');
    } finally {
      // ALWAYS clear loading so the button never sticks
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <form onSubmit={handleLogin} className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl border border-white/20 space-y-6 max-w-sm w-full">
        <h2 className="text-2xl font-semibold text-white text-center">
          Log in as {roleFromQuery.charAt(0).toUpperCase() + roleFromQuery.slice(1)}
        </h2>

        {err && <div className="text-sm text-red-300 text-center">{err}</div>}

        <input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-gray-300 focus:outline-none"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPass(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-gray-300 focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 font-bold rounded-lg transition ${
            loading
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
          } text-white`}
        >
          {loading ? 'Logging in…' : 'Log in'}
        </button>

        <p className="text-center text-gray-300 text-sm">
          Need an account?{' '}
          <a href={`/signup?role=${roleFromQuery}`} className="underline hover:text-white">
            Sign up
          </a>
        </p>
      </form>
    </div>
  );
}
