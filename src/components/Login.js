// src/components/Login.js
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Only tenant | landlord here
  const roleFromQuery = useMemo(() => {
    const r = (searchParams.get('role') || 'tenant').toLowerCase();
    return r === 'tenant' || r === 'landlord' ? r : 'tenant';
  }, [searchParams]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);

    try {
      // Kick off sign-in but don’t rely on it to settle on time
      const signInP = supabase.auth.signInWithPassword({ email, password });

      let signInSettled = false;
      let signInError = null;
      signInP.then(({ error }) => { signInSettled = true; signInError = error || null; })
             .catch((e) => { signInSettled = true; signInError = e; });

      // Poll for a session while signIn is in-flight
      let session = null;
      for (let i = 0; i < 24; i++) { // ~6s
        const { data } = await supabase.auth.getSession();
        session = data?.session || null;
        if (session) break;
        if (signInSettled && signInError) break;
        await sleep(250);
      }

      if (signInSettled && signInError) {
        throw (signInError instanceof Error ? signInError : new Error(signInError?.message || 'Login failed'));
      }

      // Last little grace period
      if (!session) {
        const race = await Promise.race([signInP, sleep(2000).then(() => ({ timeout: true }))]);
        if (!race?.timeout) {
          const { data } = await supabase.auth.getSession();
          session = data?.session || null;
        }
      }

      if (!session) throw new Error('Login did not complete. Please try again.');

      // Fetch or seed tenant/landlord profile
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
        // First login: create profile with role from query
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
        // Backfill missing role (don’t overwrite if already set)
        const { error: updErr } = await supabase
          .from('profiles')
          .update({ role: roleFromQuery })
          .eq('id', userId);
        if (updErr) throw updErr;
        role = roleFromQuery;
      }

      // Hard stop: this page is ONLY for tenant/landlord
      if (role !== 'tenant' && role !== 'landlord') {
        await supabase.auth.signOut();
        throw new Error('This account is for the Maintenance Portal. Use the Helpdesk/Contractor login.');
      }

      // Optional: enforce the URL role (nice UX guard)
      if (roleFromQuery && role !== roleFromQuery) {
        await supabase.auth.signOut();
        throw new Error(`This account is a ${role}. Open the correct login page.`);
      }

      // Route
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
        <h1 className="text-xl font-semibold text-white">Log in as {roleFromQuery[0].toUpperCase()+roleFromQuery.slice(1)}</h1>

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
          className={`w-full py-3 font-semibold rounded-lg transition ${loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-white text-purple-900 hover:bg-violet-100'}`}
        >
          {loading ? 'Logging in…' : 'Log in'}
        </button>

        <div className="text-xs text-slate-200">
          Need an account? <a href={`/signup?role=${roleFromQuery}`} className="underline">Sign up</a>
        </div>
      </form>
    </div>
  );
}
