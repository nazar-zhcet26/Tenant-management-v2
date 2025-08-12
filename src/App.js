// src/App.js
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import AppRoutes from './components/routes';

export default function App() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(undefined); // undefined = loading; null = no role

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled) setSession(session ?? null);

        if (session?.user?.id) {
          const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

          if (!cancelled) setRole(error ? null : (data?.role ?? null));
        } else {
          if (!cancelled) setRole(null);
        }
      } catch (e) {
        console.warn('App boot error:', e);
        if (!cancelled) setRole(null);
      }
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (cancelled) return;
      setSession(s ?? null);

      if (s?.user?.id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', s.user.id)
          .single();
        setRole(error ? null : (data?.role ?? null));
      } else {
        setRole(null);
      }
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // No full-screen loader here—let routes render immediately.
  return <AppRoutes session={session} role={role} />;
}
