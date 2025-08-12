// src/components/ProtectedRoute.js
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Usage:
 * <ProtectedRoute allowed={['tenant']}     fallback="/login">...</ProtectedRoute>
 * <ProtectedRoute allowed={['landlord']}   fallback="/login">...</ProtectedRoute>
 * <ProtectedRoute allowed={['helpdesk']}   fallback="/maintenance-login">...</ProtectedRoute>
 * <ProtectedRoute allowed={['contractor']} fallback="/maintenance-login">...</ProtectedRoute>
 */
export default function ProtectedRoute({ allowed = [], fallback = '/login', children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'ok' | 'noauth' | 'forbidden'
  const location = useLocation();

  useEffect(() => {
    let alive = true;

    (async () => {
      // briefly poll for a session (handles just-logged-in race)
      let { data } = await supabase.auth.getSession();
      let session = data?.session || null;
      for (let i = 0; !session && i < 12; i++) { // ~3s max
        await sleep(250);
        ({ data } = await supabase.auth.getSession());
        session = data?.session || null;
      }
      if (!alive) return;

      if (!session) return setStatus('noauth');

      const role = String(session.user?.user_metadata?.role || '').toLowerCase();
      if (allowed.length && !allowed.includes(role)) return setStatus('forbidden');

      setStatus('ok');
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!alive) return;
      if (!session) setStatus('noauth');
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [allowed]);

  if (status === 'checking') {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-slate-200">
        <div className="animate-pulse">Checking your access…</div>
      </div>
    );
  }

  if (status === 'noauth') {
    // choose which role to hint on the login page
    const roleQuery =
      allowed.includes('landlord') ? 'landlord' :
      allowed.includes('helpdesk') ? 'helpdesk' :
      allowed.includes('contractor') ? 'contractor' :
      'tenant';
    return <Navigate to={`${fallback}?role=${roleQuery}`} state={{ from: location }} replace />;
  }

  if (status === 'forbidden') {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-red-300">
        You don’t have access to this page.
      </div>
    );
  }

  return children;
}
