import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function ProtectedRoute({ allowedRole, children }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      setSession(s);
      if (s) {
        supabase
          .from('profiles')
          .select('role')
          .eq('id', s.user.id)
          .single()
          .then(({ data: profile }) => {
            setUserRole(profile?.role);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });
  }, []);

  if (loading) return <div>Loading…</div>;
  if (!session) return <Navigate to="/" replace />;
  if (allowedRole && userRole !== allowedRole) return <Navigate to="/" replace />;

  return children;
}
