import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAccess } from '../../context/AccessProvider';
import { useAuth } from '@/providers/AuthProvider';

type Role = 'admin' | 'hod' | 'proctor' | 'teacher';

export const RoleRoute: React.FC<{
  children: React.ReactNode;
  allow: Role[];
  /** /institute only: someone who signed up as "institute" and has no institute yet may open the page to create one. */
  allowNewInstituteOwner?: boolean;
}> = ({ children, allow, allowNewInstituteOwner }) => {
  const { access, loading, failed, retry } = useAccess();
  const { role: signupRole } = useAuth();
  const location = useLocation();

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>;
  // Couldn't reach the server — the user is still signed in, so offer a retry instead of /login.
  if (failed) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>Couldn't load your account. Check your internet connection.</p>
        <button type="button" onClick={retry} style={{ marginTop: 12, padding: '8px 16px', border: '1px solid currentColor', borderRadius: 8 }}>
          Try again
        </button>
      </div>
    );
  }
  if (!access) return <Navigate to="/login" replace />;
  if (allowNewInstituteOwner && access.primary_role === 'none' && signupRole === 'institute') {
    return <>{children}</>;
  }
  // No institute membership = independent teacher: they get the personal teacher dashboard.
  const role: Role = access.primary_role === 'none' ? 'teacher' : (access.primary_role as Role);
  if (!allow.includes(role)) {
    const target = access.home_route || '/dashboard';
    // Never redirect to the page we are already on (that renders a blank screen).
    if (target === location.pathname) {
      return <div style={{ padding: 40, textAlign: 'center' }}>You don't have access to this page.</div>;
    }
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
};
