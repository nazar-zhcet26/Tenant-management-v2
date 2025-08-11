import React, { useState } from 'react';
import { supabase } from '../supabase';
import { useNavigate, useLocation } from 'react-router-dom';

export default function LoginTeam() {
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const role = queryParams.get('role'); // expected 'helpdesk' or 'contractor'

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');

        if (!role || (role !== 'helpdesk' && role !== 'contractor')) {
            setErrorMsg('Invalid role. Use the correct login link.');
            setLoading(false);
            return;
        }

        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (loginError || !loginData.session) {
            setErrorMsg('Login failed. Please check your credentials.');
            setLoading(false);
            return;
        }

        const user = loginData.user;

        // Upsert profile with role (to allow RLS policies to work)
        const { error: upsertError } = await supabase
            .from('profiles')
            .upsert(
                {
                    id: user.id,
                    email: user.email,
                    full_name: user.user_metadata.full_name || '',
                    role,
                },
                { onConflict: 'id' }
            );

        if (upsertError) console.warn('Profile upsert failed:', upsertError.message);

        // Fetch profile role to verify
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

        if (profileData.role !== role) {
            setErrorMsg('Role mismatch. Please use the correct login portal.');
            await supabase.auth.signOut();
            setLoading(false);
            return;
        }

        // Redirect based on role
        if (role === 'helpdesk') {
            navigate('/helpdesk-dashboard');
        } else if (role === 'contractor') {
            navigate('/contractor-dashboard');
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
            <form
                onSubmit={handleLogin}
                className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl border border-white/20 space-y-6 max-w-sm w-full"
            >
                <h2 className="text-2xl font-semibold text-white text-center">
                    Log in as {role?.charAt(0).toUpperCase() + role?.slice(1) || 'Team'}
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
                    className={`w-full py-3 font-bold rounded-lg transition ${loading
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
