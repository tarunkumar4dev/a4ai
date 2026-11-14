import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAccess } from '../../context/AccessProvider';
import { useAuth } from '@/providers/AuthProvider';
import { isStudentOnly, resolveHomeRoute } from '@/lib/homeRoute';

type Role = 'admin' | 'hod' | 'proctor' | 'teacher';

export const RoleRoute: React.FC<{
  children: React.ReactNode;
  allow: Role[];
  /** /institute only: someone who signed up as "institute" and has no institute yet may open the page to create one. */
  allowNewInstituteOwner?: boolean;
}> = ({ children, allow, allowNewInstituteOwner }) => {
  const { access, loading, error, refresh } = useAccess();
  const { role: signupRole } = useAuth();
  const location = useLocation();

  if (loading) return <div role="status" style={{ padding: 40, textAlign: 'center' }}>Loading…</div>;
  // Signed in, but the access check failed (offline / server error): offer a retry — sending a signed-in
  // user to /login would just bounce them back here.
  if (!access && error) {
    return (
      <div role="alert" style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ fontWeight: 700 }}>We couldn't check your access.</p>
        <p style={{ marginTop: 4, fontSize: 14, color: '#64748b' }}>Check your internet connection and try again.</p>
        <button
          onClick={refresh}
          style={{ marginTop: 16, minHeight: 44, padding: '8px 20px', borderRadius: 12, background: '#0f172a', color: '#fff', fontWeight: 700 }}
        >
          Retry
        </button>
      </div>
    );
  }
  if (!access) return <Navigate to="/login" replace />;
  if (allowNewInstituteOwner && access.primary_role === 'none' && signupRole === 'institute') {
    return <>{children}</>;
  }
  // No institute membership = independent teacher: they get the personal teacher dashboard —
  // unless they signed up as a student (they go to the student dashboard instead).
  const role: Role = access.primary_role === 'none' ? 'teacher' : (access.primary_role as Role);
  if (isStudentOnly(access, signupRole) || !allow.includes(role)) {
    const target = resolveHomeRoute(access, signupRole);
    // Never redirect to the page we are already on (that renders a blank screen).
    if (target === location.pathname) {
      return <div style={{ padding: 40, textAlign: 'center' }}>You don't have access to this page.</div>;
    }
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
};
