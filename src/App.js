// src/App.js
import { useState, useEffect } from 'react';
import { supabase } from './supabase';  // Listen for changesimport { useState, useEffect } from 'react';
import AppRoutes from './components/routes';

function App() {
  const [session, setSession] = useState(null);
  const [role, setRole]       = useState(null);

  useEffect(() => {
    // Grab initial session
    const sess = supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setRole(data.session?.user?.user_metadata?.role || null);
    });

function App() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    async function fetchSessionAndRole() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);

      if (session?.user) {
        // Fetch role from profiles table
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (!error && profileData) {
          setRole(profileData.role);
        } else {
          setRole(null);
        }
      } else {
        setRole(null);
      }
    }

    fetchSessionAndRole();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);

      if (newSession?.user) {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', newSession.user.id)
          .single();

        if (!error && profileData) {
          setRole(profileData.role);
        } else {
          setRole(null);
        }
      } else {
        setRole(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return <AppRoutes session={session} role={role} />;
}

export default App;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setRole(newSession?.user?.user_metadata?.role || null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return <AppRoutes session={session} role={role} />;
}

export default App;
