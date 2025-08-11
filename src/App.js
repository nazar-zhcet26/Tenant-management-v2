import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import AppRoutes from './components/routes';

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
