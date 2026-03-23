// src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";

type Props = {
  /** If set, only this role can access the wrapped routes */
  allowedRole?: "student" | "teacher" | "institute";
};

export default function ProtectedRoute({ allowedRole }: Props) {
  const { session, role, loading } = useAuth();

  // Still checking auth — show a simple spinner
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-black/20 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  // Not logged in → go to login
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but no role set → go pick a role
  if (!role) {
    return <Navigate to="/select-role" replace />;
  }

  // Role doesn't match this section → redirect to their own dashboard
  if (allowedRole && role !== allowedRole) {
    return <Navigate to={`/${role}/dashboard`} replace />;
  }

  return <Outlet />;
}