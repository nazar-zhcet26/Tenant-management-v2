// src/components/Signup.js
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

const Signup = () => {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const role = params.get('role') || 'tenant';
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignup = async () => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return alert(error.message);

    // Also insert into your profiles table:
    await supabase
      .from('profiles')
      .insert([{ id: data.user.id, email, role }]);

    // Then send them to the appropriate page
    navigate(role === 'tenant' ? '/report' : '/dashboard');
  };

  return (
    <div className="…your card…">
      <h2>Sign up as {role.charAt(0).toUpperCase() + role.slice(1)}</h2>
      {/* email/password fields… */}
      <button onClick={handleSignup}>Sign Up</button>
    </div>
  );
};

export default Signup;
