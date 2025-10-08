import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

const SignupPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formValues, setFormValues] = useState({
    name: "",
    email: "",
    password: "",
    acceptTerms: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues((prev) => ({
      ...prev,
      [e.target.name]:
        e.target.type === "checkbox" ? (e.target as any).checked : e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);

    try {
      const {
        data: { user, session },
        error: signUpError,
      } = await supabase.auth.signUp({
        email: formValues.email.trim(),
        password: formValues.password,
        options: {
          data: { full_name: formValues.name, role: "teacher" },
          // If email confirmation is ON, Supabase will send a verify link here.
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (signUpError) throw signUpError;

      // If your project doesn't require email confirmation: session exists → upsert profile and go to dashboard
      if (session && user) {
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: user.id,
          email: formValues.email.trim(),
          full_name: formValues.name,
          role: "teacher",
          updated_at: new Date().toISOString(),
        });
        if (profileError) throw profileError;

        toast({ title: "Welcome!", description: "Account created successfully." });
        navigate("/dashboard", { replace: true });
        return;
      }

      // If confirmation is required: user/session may be null → ask to verify email
      toast({
        title: "Verify your email",
        description: "We’ve sent you a verification link. Please check your inbox to activate your account.",
      });
      // Optional: keep them on signup or redirect to a lightweight info page
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
    if (isLoading) return;
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
      // success path will leave page; do not reset loading
    } catch (error: any) {
      toast({
        title: "Google signup failed",
        description: error?.message || "Try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#DFE4EF]">
      {/* Left: form card */}
      <div className="flex flex-1 flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl ring-1 ring-black/5 p-8">
            <div className="text-center">
              <Link to="/" className="inline-block">
                <span className="text-2xl font-extrabold text-gray-900 tracking-tight">a4ai</span>
              </Link>
              <h2 className="mt-4 text-3xl font-bold text-gray-900">Create your account</h2>
              <p className="mt-2 text-sm text-gray-600">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-gray-800 underline-offset-4 hover:underline">
                  Sign in
                </Link>
              </p>
            </div>

            <div className="mt-8 space-y-6">
              <Button
                onClick={handleGoogleSignup}
                disabled={isLoading}
                variant="outline"
                className="w-full flex items-center justify-center gap-2 rounded-lg border-gray-300 bg-white hover:bg-gray-100"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l-3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign up with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500">Or continue with</span>
                </div>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
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
                    className="mt-1 bg-gray-50/80 border-gray-300 focus:bg-white focus:ring-2 focus:ring-blue-500/40"
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
                    className="mt-1 bg-gray-50/80 border-gray-300 focus:bg-white focus:ring-2 focus:ring-blue-500/40"
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
                    className="mt-1 bg-gray-50/80 border-gray-300 focus:bg-white focus:ring-2 focus:ring-blue-500/40"
                  />
                  <p className="text-xs text-gray-500 mt-1">Password must be at least 8 characters long</p>
                </div>

                <div className="flex items-center">
                  <Checkbox
                    id="acceptTerms"
                    name="acceptTerms"
                    checked={formValues.acceptTerms}
                    onCheckedChange={(checked) =>
                      setFormValues((s) => ({ ...s, acceptTerms: checked as boolean }))
                    }
                  />
                  <label htmlFor="acceptTerms" className="ml-2 text-sm text-gray-700">
                    I agree to the{" "}
                    <Link to="/terms" className="font-medium text-gray-900 underline-offset-4 hover:underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link to="/privacy" className="font-medium text-gray-900 underline-offset-4 hover:underline">
                      Privacy Policy
                    </Link>
                  </label>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !formValues.acceptTerms}
                  className="w-full h-12 rounded-full text-white font-medium
                             bg-black shadow-[0_8px_24px_rgba(0,0,0,0.18)]
                             hover:bg-gradient-to-r hover:from-blue-500 hover:via-blue-600 hover:to-blue-700
                             active:from-blue-600 active:via-blue-700 active:to-blue-800
                             transition-all duration-300"
                >
                  {isLoading ? "Creating account..." : "Create account"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Right: soft grey showcase panel */}
      <div className="hidden lg:block relative flex-1">
        <div className="absolute inset-0 bg-[#DFE4EF]" />
        <div className="absolute inset-0 opacity-90 bg-[radial-gradient(1000px_600px_at_30%_20%,rgba(255,255,255,0.9),transparent_60%)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="max-w-md text-center p-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Join a4ai Today</h2>
            <p className="text-lg text-gray-700">
              Create customized, high-quality test papers in minutes using the power of AI.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
