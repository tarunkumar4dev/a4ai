import { Navigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";

const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const { profile, loading } = useUserProfile();

  if (loading) return <div>Loading...</div>;

  if (!profile) return <Navigate to="/login" replace />;

  return children;
};

export default PrivateRoute;
