import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate, useLocation } from 'react-router-dom';

export default function LoginTeam() {
    const navigate = useNavigate();
    const location = useLocation();

    // Get role from URL query param
    const queryParams = new URLSearchParams(location.search);
    const roleFromQuery = queryParams.get('role'); // 'helpdesk' or 'contractor'

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    // Optional: Customize UI based on roleFromQuery
    const roleLabel = roleFromQuery === 'helpdesk' ? 'Helpdesk' : roleFromQuery === 'contractor' ? 'Contractor' : 'Team';

    const handleLogin = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!roleFromQuery || (roleFromQuery !== 'helpdesk' && roleFromQuery !== 'contractor')) {
            setErrorMsg('Invalid login role. Please use the correct login link.');
            return;
        }

        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (signInError || !signInData.session) {
            setErrorMsg('Login failed. Please check your credentials.');
            return;
        }

        const userId = signInData.user.id;

        // Fetch user role from profiles
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (profileError || !profileData) {
            setErrorMsg('User profile not found.');
            return;
        }

        // Check if profile role matches URL role param
        if (profileData.role !== roleFromQuery) {
            setErrorMsg(`Access denied. This login is for ${roleFromQuery} users only.`);
            await supabase.auth.signOut();
            return;
        }

        // Redirect based on role
        if (profileData.role === 'helpdesk') {
            navigate('/helpdesk-dashboard');
        } else if (profileData.role === 'contractor') {
            navigate('/contractor-dashboard');
        }
    };

    return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6">
            <h1 className="text-3xl mb-6">{roleLabel} Login</h1>
            <form
                onSubmit={handleLogin}
                className="bg-white/10 rounded p-6 flex flex-col w-full max-w-sm"
            >
                <label className="mb-2 font-semibold" htmlFor="email">
                    Email
                </label>
                <input
                    id="email"
                    type="email"
                    className="mb-4 p-2 rounded text-black"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                />

                <label className="mb-2 font-semibold" htmlFor="password">
                    Password
                </label>
                <input
                    id="password"
                    type="password"
                    className="mb-4 p-2 rounded text-black"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                {errorMsg && <p className="mb-4 text-red-400">{errorMsg}</p>}

                <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 py-2 rounded font-semibold"
                >
                    Log In
                </button>
            </form>
        </div>
    );
}
