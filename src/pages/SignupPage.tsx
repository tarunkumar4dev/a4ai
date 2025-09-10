// src/pages/SignupPage.tsx
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase, getAuthRedirectURL } from "@/lib/supabaseClient";

const SignupPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formValues, setFormValues] = useState({
    name: "",
    email: "",
    password: "",
    acceptTerms: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues({
      ...formValues,
      [e.target.name]:
        e.target.type === "checkbox" ? (e.target as any).checked : e.target.value,
    });
  };

  /** Same as Login: prefer state.from → state.next → ?next → /dashboard */
  const resolveNext = () => {
    const state = location.state as { from?: string; next?: string } | null;
    const qsNext = new URLSearchParams(location.search).get("next");
    return state?.from || state?.next || qsNext || "/dashboard";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const next = resolveNext();
      const emailRedirect = new URL(getAuthRedirectURL());
      emailRedirect.searchParams.set("next", next);

      const {
        data: { user },
        error: signUpError,
      } = await supabase.auth.signUp({
        email: formValues.email,
        password: formValues.password,
        options: {
          data: { full_name: formValues.name }, // no role here
          // After the user verifies email, they’ll land on /auth/callback → we restore `next`
          emailRedirectTo: emailRedirect.toString(),
        },
      });

      if (signUpError) throw signUpError;

      // Do NOT insert into profiles here; let the DB trigger or onAuthStateChange upsert handle it.
      // Many projects require email verification, so navigating to dashboard is misleading.
      toast({
        title: "Verify your email",
        description: "We’ve sent a confirmation link. Click it to complete signup.",
      });

      navigate("/login", { replace: true, state: { next } });
    } catch (error: any) {
      toast({
        title: "Signup failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    try {
      const next = resolveNext();
      const redirectTo = new URL(getAuthRedirectURL());
      redirectTo.searchParams.set("next", next);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTo.toString(),
          queryParams: {
            // In dev you might use: access_type: "offline", prompt: "consent"
            prompt: "select_account",
          },
        },
      });
      if (error) throw error;
      // Redirects to Google → /auth/callback (no manual navigate)
    } catch (error: any) {
      toast({
        title: "Google signup failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="flex flex-1 flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md">
          <div className="text-center">
            <Link to="/" className="inline-block">
              <span className="text-2xl font-extrabold logo">a4ai</span>
            </Link>
            <h2 className="mt-6 text-3xl font-bold">Create your account</h2>
            <p className="mt-2 text-gray-600">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-a4ai-purple hover:underline"
                state={{ next: resolveNext() }}
              >
                Sign in
              </Link>
            </p>
          </div>

          <div className="mt-8">
            <Button
              onClick={handleGoogleSignup}
              disabled={isLoading}
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Sign up with Google
            </Button>

            <div className="mt-6 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-gray-50 px-2 text-gray-500">Or continue with</span>
              </div>
            </div>

            <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={formValues.name}
                  onChange={handleChange}
                  className="mt-1"
                />
              </div>

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
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formValues.password}
                  onChange={handleChange}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Password must be at least 8 characters long
                </p>
              </div>

              <div className="flex items-center">
                <Checkbox
                  id="acceptTerms"
                  name="acceptTerms"
                  checked={formValues.acceptTerms}
                  onCheckedChange={(checked) =>
                    setFormValues((prev) => ({ ...prev, acceptTerms: !!checked }))
                  }
                />
                <label htmlFor="acceptTerms" className="ml-2 text-sm text-gray-600">
                  I agree to the{" "}
                  <Link to="/terms" className="text-a4ai-purple hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="text-a4ai-purple hover:underline">
                    Privacy Policy
                  </Link>
                </label>
              </div>

              <Button
                type="submit"
                disabled={isLoading || !formValues.acceptTerms}
                className="w-full bg-a4ai-purple hover:bg-a4ai-purple-hover"
              >
                {isLoading ? "Creating account..." : "Create account"}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="hidden lg:block relative flex-1 bg-a4ai-purple">
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <div className="max-w-md text-center p-8">
            <h2 className="text-3xl font-bold mb-6">Join a4ai Today</h2>
            <p className="text-xl">
              Create customized, high-quality test papers in minutes using the power of AI.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
