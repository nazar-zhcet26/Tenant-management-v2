// src/components/Signup.js
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Signup() {
  const [fullName, setFullName] = useState('');
  const [email,    setEmail   ] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading ] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role') || 'tenant';

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);

    // 1) Trigger Supabase magic-link signup
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role }
      }
    });

    if (signUpError) {
      setLoading(false);
      return alert('Sign-up error: ' + signUpError.message);
    }

    // 2) No profile.insert here — wait until login when auth.uid() exists

    setLoading(false);
    // 3) Navigate to our “please check your email” screen
    navigate('/check-your-email');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <form onSubmit={handleSignup} className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl border border-white/20 space-y-6 max-w-sm w-full">
        <h2 className="text-2xl font-semibold text-white text-center">
          Sign up as {role.charAt(0).toUpperCase() + role.slice(1)}
        </h2>

        <input
          type="text"
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-gray-300 focus:outline-none"
        />

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
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-gray-300 focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 font-bold rounded-lg transition ${
            loading
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
          } text-white`}
        >
          {loading ? 'Signing up...' : 'Sign up'}
        </button>

        <p className="text-center text-gray-300 text-sm">
          Already have an account?{' '}
          <a href={`/login?role=${role}`} className="underline hover:text-white">
            Log in
          </a>
        </p>
      </form>
    </div>
  );
}
