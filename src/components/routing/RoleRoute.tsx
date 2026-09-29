import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAccess } from '../../context/AccessProvider';

type Role = 'admin' | 'hod' | 'proctor' | 'teacher';

export const RoleRoute: React.FC<{ children: React.ReactNode; allow: Role[] }> = ({ children, allow }) => {
  const { access, loading } = useAccess();

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>;
  if (!access) return <Navigate to="/login" replace />;
  if (access.primary_role === 'none' || !allow.includes(access.primary_role as Role)) {
    return <Navigate to={access.home_route || '/dashboard'} replace />;
  }
  return <>{children}</>;
};