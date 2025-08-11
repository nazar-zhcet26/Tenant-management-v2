// src/App.js
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import AppRoutes from './components/routes';

/**
 * App bootstraps:
 * - current auth session
 * - profile role from `profiles` (id = auth.user.id)
 * - listens to auth changes to keep state in sync
 *
 * Conventions:
 * - role === undefined  -> still loading / unresolved
 * - role === null       -> resolved but no role on profile
 * - role === 'tenant' | 'landlord' | 'helpdesk' | 'contractor'
 */
export default function App() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(undefined);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      // 1) load session
      const {
        data: { session },
        error: sessionErr,
      } = await supabase.auth.getSession();

      if (!cancelled) setSession(session || null);

      // 2) load role if logged in
      if (session?.user?.id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (!cancelled) {
          if (error) {
            console.warn('profiles role fetch error:', error.message);
            setRole(null);
          } else {
            setRole(data?.role ?? null);
          }
        }
      } else {
        if (!cancelled) setRole(null);
      }

      if (!cancelled) setInitializing(false);
    }

    loadInitial();

    // 3) subscribe to auth changes
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (cancelled) return;

      setSession(newSession || null);

      // When signed in or token refreshed, (re)fetch role
      if (newSession?.user?.id && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', newSession.user.id)
          .single();

        if (error) {
          console.warn('profiles role fetch (auth change) error:', error.message);
          setRole(null);
        } else {
          setRole(data?.role ?? null);
        }
      }

      // On sign out, clear role
      if (event === 'SIGNED_OUT' || !newSession?.user) {
        setRole(null);
      }
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // Optional: show a lightweight global splash while the *very first* load happens
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-white">
          <svg className="animate-spin h-10 w-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="text-sm text-slate-300">Loading PropertyCare…</p>
        </div>
      </div>
    );
  }

  return <AppRoutes session={session} role={role} />;
}
