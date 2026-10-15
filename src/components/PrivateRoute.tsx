import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";

// Waits for AuthProvider to restore the stored session before deciding — never redirects while loading.
const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const location = useLocation();
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
          message: "Please sign in to access this page"
        }}
      />
    );
  }

  return children;
};

export default PrivateRoute;
