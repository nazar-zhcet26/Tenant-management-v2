import React, { useState } from 'react';
import { supabase } from '../supabase';
import { useNavigate, useLocation } from 'react-router-dom';

export default function LoginTeam() {
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const roleFromQuery = queryParams.get('role'); // 'helpdesk' or 'contractor'

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    console.log('Login attempt started'); // Log handler call
    setErrorMsg('');
    setLoading(true);

    try {
      console.log('Calling supabase.auth.signInWithPassword...');
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      console.log('loginData:', loginData);
      console.log('loginError:', loginError);

      if (loginError || !loginData.session) {
        setErrorMsg('Login failed. Please check your credentials.');
        setLoading(false);
        return;
      }

      const user = loginData.user;

      // Upsert profile with role from query
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata.full_name || '',
            role: roleFromQuery,
          },
          { onConflict: 'id' }
        );

      if (upsertError) {
        console.warn('Profile upsert failed:', upsertError.message);
      } else {
        console.log('Profile upsert successful');
      }

      // Fetch profile to confirm role
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData) {
        setErrorMsg('User profile not found.');
        setLoading(false);
        return;
      }

      console.log('Fetched profile role:', profileData.role);

      if (profileData.role !== roleFromQuery) {
        setErrorMsg('Role mismatch. Please use the correct login portal.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      if (profileData.role === 'helpdesk') {
        console.log('Redirecting to helpdesk dashboard');
        navigate('/helpdesk-dashboard');
      } else if (profileData.role === 'contractor') {
        console.log('Redirecting to contractor dashboard');
        navigate('/contractor-dashboard');
      }

      setLoading(false);
    } catch (err) {
      console.error('Login exception:', err);
      setErrorMsg('Unexpected error during login.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <form
        onSubmit={handleLogin}
        className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl border border-white/20 space-y-6 max-w-sm w-full"
      >
        <h2 className="text-2xl font-semibold text-white text-center">
          Log in as {roleFromQuery?.charAt(0).toUpperCase() + roleFromQuery?.slice(1) || 'Team'}
        </h2>

        <input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-gray-300 focus:outline-none"
          autoFocus
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-gray-300 focus:outline-none"
        />

        {errorMsg && <p className="text-red-400 text-center">{errorMsg}</p>}

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
      </form>
    </div>
  );
}
