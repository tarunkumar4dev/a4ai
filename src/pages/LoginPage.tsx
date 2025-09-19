import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { Eye, EyeOff } from "lucide-react";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [formValues, setFormValues] = useState({ email: "", password: "" });

  // OAuth callback -> dashboard
  useEffect(() => {
    if (location.state?.from === "oauth-callback") {
      navigate("/dashboard", { replace: true });
    }
  }, [location, navigate]);

  // Existing session -> dashboard
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) navigate("/dashboard", { replace: true });
    };
    checkSession();
  }, [navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues((s) => ({ ...s, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formValues.email,
        password: formValues.password,
      });
      if (error) throw error;

      // Optionally persist session preference
      // You can store 'remember' in localStorage to adjust your auth persistence if needed
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (error) throw error;
    } catch (error) {
      toast({
        title: "Google login failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#DFE4EF]">
      {/* Left: form card (same as Signup) */}
      <div className="flex flex-1 flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl ring-1 ring-black/5 p-8">
            <div className="text-center">
              <Link to="/" className="inline-block">
                <span className="text-2xl font-extrabold text-gray-900 tracking-tight">Hii,</span>
              </Link>
              <h2 className="mt-4 text-3xl font-bold text-gray-900">Welcome back</h2>
              <p className="mt-2 text-sm text-gray-600">
                New here?{" "}
                <Link to="/signup" className="font-medium text-gray-800 underline-offset-4 hover:underline">
                  Create an account
                </Link>
              </p>
            </div>

            <div className="mt-8 space-y-6">
              {/* Google button (matched to Signup) */}
              <Button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                variant="outline"
                className="w-full flex items-center justify-center gap-2 rounded-lg border-gray-300 bg-white hover:bg-gray-100"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign in with Google
              </Button>

              {/* Divider (matched) */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500">Or continue with</span>
                </div>
              </div>

              {/* Form (matched inputs + focus styles) */}
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formValues.email}
                    onChange={handleChange}
                    className="mt-1 bg-gray-50/80 border-gray-300 focus:bg-white focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link to="/forgot-password" className="text-sm font-medium text-gray-700 hover:underline underline-offset-4">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPw ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={formValues.password}
                      onChange={handleChange}
                      className="mt-1 bg-gray-50/80 border-gray-300 pr-12 focus:bg-white focus:ring-2 focus:ring-blue-500/40"
                    />
                    <button
                      type="button"
                      aria-label={showPw ? "Hide password" : "Show password"}
                      onClick={() => setShowPw((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={remember}
                    onCheckedChange={(c) => setRemember(Boolean(c))}
                  />
                  <label htmlFor="remember" className="text-sm text-gray-700">
                    Remember me
                  </label>
                </div>

                {/* Primary submit: black -> glossy blue on hover (same vibe as Signup) */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 rounded-full text-white font-medium
                             bg-black shadow-[0_8px_24px_rgba(0,0,0,0.18)]
                             hover:bg-gradient-to-r hover:from-blue-500 hover:via-blue-600 hover:to-blue-700
                             active:from-blue-600 active:via-blue-700 active:to-blue-800
                             transition-all duration-300"
                >
                  {isLoading ? "Signing in…" : "Log In"}
                </Button>

                <p className="text-center text-sm text-gray-600">
                  Don’t have an account?{" "}
                  <Link to="/signup" className="font-medium text-gray-900 underline-offset-4 hover:underline">
                    Sign up
                  </Link>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Right: soft grey showcase panel (same structure/colors as Signup) */}
      <div className="hidden lg:block relative flex-1">
        <div className="absolute inset-0 bg-[#DFE4EF]" />
        <div
          className="absolute inset-0 opacity-90
                     bg-[radial-gradient(1000px_600px_at_30%_20%,rgba(255,255,255,0.9),transparent_60%)]"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="max-w-md text-center p-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome back to a4ai</h2>
            <p className="text-lg text-gray-700">
              Sign in to create and manage high-quality test papers in minutes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
