// src/components/Login.js
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from './supabase';

// tiny helper for polling
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Login() {
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const navigate              = useNavigate();
  const [searchParams]        = useSearchParams();
  const roleFromQuery         = (searchParams.get('role') || 'tenant').toLowerCase(); // 'tenant' | 'landlord'

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);

    try {
      // Kick off sign-in but do not rely on it finishing on time
      const signInP = supabase.auth.signInWithPassword({ email, password });

      // Track whether signIn settles and with what error
      let signInSettled = false;
      let signInError = null;
      signInP
        .then(({ error }) => { signInSettled = true; signInError = error || null; })
        .catch((e) => { signInSettled = true; signInError = e; });

      // Poll for a session (auth token) up to ~6s while signIn is in-flight
      let session = null;
      for (let i = 0; i < 24; i++) {
        const { data } = await supabase.auth.getSession();
        session = data?.session || null;
        if (session) break;                    // success: we have a session from Supabase
        if (signInSettled && signInError) break; // early stop on explicit failure
        await sleep(250);
      }

      // If signIn already failed, surface that
      if (signInSettled && signInError) {
        throw (signInError instanceof Error ? signInError : new Error(signInError?.message || 'Login failed'));
      }

      // Last small window to let signIn settle if we still don't have a session
      if (!session) {
        const race = await Promise.race([
          signInP,
          sleep(2000).then(() => ({ timeout: true })),
        ]);
        if (!race?.timeout) {
          const { data } = await supabase.auth.getSession();
          session = data?.session || null;
        }
      }

      if (!session) throw new Error('Login did not complete. Please try again.');

      // We have a session → fetch profile (don’t overwrite an existing role)
      const userId = session.user.id;
      const { data: got, error: selErr } = await supabase
        .from('profiles')
        .select('id, role, full_name')
        .eq('id', userId)
        .limit(1);
      if (selErr) throw selErr;

      let role = got?.[0]?.role || null;
      if (!role) {
        // Insert profile only if missing role/row; seed role from the URL on first login
        const full_name = session.user.user_metadata?.full_name || '';
        const { error: insErr } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: session.user.email || email,
            full_name,
            role: roleFromQuery === 'landlord' ? 'landlord' : 'tenant',
          });
        if (insErr) throw insErr;
        role = roleFromQuery === 'landlord' ? 'landlord' : 'tenant';
      }

      // Route based on stored role
      if (role === 'tenant') {
        navigate('/report', { replace: true });
      } else if (role === 'landlord') {
        navigate('/dashboard', { replace: true });
      } else if (role === 'helpdesk') {
        navigate('/helpdesk-dashboard', { replace: true });
      } else if (role === 'contractor') {
        navigate('/contractor-dashboard', { replace: true });
      } else {
        await supabase.auth.signOut();
        throw new Error('Unsupported role on this account. Contact admin.');
      }
    } catch (e) {
      console.error('[login]', e);
      setErr(e.message || 'Unexpected error. Please try again.');
    } finally {
      setLoading(false); // never leave the spinner on
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
          {loading ? 'Logging in...' : 'Log in'}
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
