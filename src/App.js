// src/App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './components/routes';
import { supabase } from './supabase';
import './App.css';

function App() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserRole(session.user.id);
    });

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) fetchUserRole(newSession.user.id);
      else setRole(null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function fetchUserRole(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching role:', error);
    } else {
      setRole(data.role);
    }
  }

  return (
    <BrowserRouter>
      <AppRoutes session={session} role={role} />
    </BrowserRouter>
  );
}

export default App;
