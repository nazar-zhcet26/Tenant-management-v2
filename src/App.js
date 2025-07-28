// src/App.js
import { useState, useEffect } from 'react';
import { supabase } from './supabase';
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

    // Listen for changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setRole(newSession?.user?.user_metadata?.role || null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return <AppRoutes session={session} role={role} />;
}

export default App;
