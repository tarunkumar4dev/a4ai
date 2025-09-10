import { useState, useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

type PrivateRouteProps = { children: React.ReactElement };

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    // Initial check
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted.current) return;
        setHasSession(!!session);
      } catch (error) {
        console.error("Auth check error:", error);
        if (!mounted.current) return;
        setHasSession(false);
      } finally {
        if (mounted.current) setAuthChecked(true);
      }
    })();

    // Subscribe to auth state changes (login, logout, token refresh)
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted.current) return;
      setHasSession(!!session);
    });

    return () => {
      mounted.current = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  if (!authChecked) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (!hasSession) {
    const from =
      `${location.pathname}${location.search ?? ""}${location.hash ?? ""}` || "/dashboard";

    return (
      <Navigate
        to="/login"
        replace
        state={{
          from,
          message: "Please sign in to access this page",
        }}
      />
    );
  }

  return children;
};

export default PrivateRoute;
