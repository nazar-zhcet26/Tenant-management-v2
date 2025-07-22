// src/components/Login.js
import React, { useState } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        const { data: { user }, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            alert(error.message);
            return;
        }
        // Fetch the user’s role from profiles table
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        if (profileError) {
            alert(profileError.message);
            return;
        }
        // Redirect based on role
        if (profile.role === 'landlord') navigate('/dashboard');
        else navigate('/report');
    };

    return (
        <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-lg shadow">
            <h2 className="text-2xl font-bold mb-4">Log in to PropertyCare</h2>
            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <label className="block mb-1 font-medium">Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        className="w-full px-4 py-2 border rounded"
                    />
                </div>
                <div>
                    <label className="block mb-1 font-medium">Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        className="w-full px-4 py-2 border rounded"
                    />
                </div>
                <button
                    type="submit"
                    className="w-full py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700"
                >
                    Log In
                </button>
            </form>
        </div>
    );
};

export default Login;

