import { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setHasSession(!!session);
      } catch (error) {
        console.error("Auth check error:", error);
        setHasSession(false);
      } finally {
        setAuthChecked(true);
      }
    };

    checkAuth();
  }, []);

  if (!authChecked) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!hasSession) {
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