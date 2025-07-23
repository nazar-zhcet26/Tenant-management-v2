// src/components/Login.js
import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';

const Login = () => {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const role = params.get('role') || 'tenant'; // default to tenant
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return alert(error.message);
    // After login, send them to the correct page:
    navigate(role === 'tenant' ? '/report' : '/dashboard');
  };

  return (
    <div className="…your centered card…">
      <h2>Log in as {role.charAt(0).toUpperCase() + role.slice(1)}</h2>
      {/* email/password fields… */}
      <button onClick={handleLogin}>Log In</button>

      <p className="mt-4 text-sm">
        Need an account?{' '}
        <Link to={`/signup?role=${role}`} className="text-blue-500 underline">
          Sign up
        </Link>
      </p>
    </div>
  );
};

export default Login;
