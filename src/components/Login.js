// src/components/Login.js
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Login() {
  const [email,   setEmail  ] = useState('');
  const [password,setPass   ] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role') || 'tenant';

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    // 1) Sign in
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (loginError) {
      setLoading(false);
      return alert('Login error: ' + loginError.message);
    }

    const user = loginData.user;

    // 2) Upsert profile (now that auth.uid() exists)
    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata.full_name || '',
        role
      }, { onConflict: 'id' });

    if (upsertError) {
      console.warn('Profile upsert failed:', upsertError.message);
      // We do NOT block the login—just proceed
    }

    // 3) Redirect into the app
    setLoading(false);
    if (role === 'tenant') {
      navigate('/report');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <form onSubmit={handleLogin} className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl border border-white/20 space-y-6 max-w-sm w-full">
        <h2 className="text-2xl font-semibold text-white text-center">
          Log in as {role.charAt(0).toUpperCase() + role.slice(1)}
        </h2>

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
          <a href={`/signup?role=${role}`} className="underline hover:text-white">
            Sign up
          </a>
        </p>
      </form>
    </div>
  );
}
