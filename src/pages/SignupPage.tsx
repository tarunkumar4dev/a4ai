import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { Confetti } from "@/components/ui/confetti";

const SignupPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showScratchCard, setShowScratchCard] = useState(false);
  const [coinsScratched, setCoinsScratched] = useState(false);
  const [scratchProgress, setScratchProgress] = useState(0);
  const [formValues, setFormValues] = useState({
    name: "",
    email: "",
    password: "",
    acceptTerms: false,
  });

  // Scratch card effect
  const handleScratch = (e: React.MouseEvent) => {
    if (!coinsScratched) {
      setScratchProgress(prev => Math.min(prev + 25, 100));
    }
  };

  const handleScratchComplete = () => {
    if (scratchProgress >= 70 && !coinsScratched) {
      setCoinsScratched(true);
      // Add coins to user profile here
      addWelcomeCoins();
    }
  };

  const addWelcomeCoins = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Update user's coin balance in profiles table
        const { error } = await supabase
          .from('profiles')
          .update({ coins: 100 })
          .eq('id', user.id);

        if (!error) {
          toast({
            title: "🎉 Congratulations!",
            description: "100 FREE coins added to your account!",
          });
        }
      }
    } catch (error) {
      console.error("Error adding coins:", error);
    }
  };

  useEffect(() => {
    handleScratchComplete();
  }, [scratchProgress]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues((prev) => ({
      ...prev,
      [e.target.name]:
        e.target.type === "checkbox" ? (e.target as any).checked : e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formValues.acceptTerms) {
      toast({
        title: "Terms required",
        description: "Please accept the terms and conditions",
        variant: "destructive",
      });
      return;
    }

    if (formValues.password.length < 6) {
      toast({
        title: "Weak password",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    if (isLoading) return;
    setIsLoading(true);

    try {
      console.log("🔄 Starting signup process...");

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formValues.email.trim(),
        password: formValues.password,
        options: {
          data: { 
            full_name: formValues.name, 
            role: "teacher" 
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        console.error("❌ Signup error:", signUpError);
        throw signUpError;
      }

      console.log("✅ Auth signup successful:", data);

      const { user, session } = data;

      // Case 1: Email confirmation required
      if (!user) {
        toast({
          title: "Check your email!",
          description: "We've sent a verification link to your email address.",
        });
        navigate("/login?message=check-email");
        return;
      }

      // Case 2: Auto-confirmed - Show scratch card!
      if (session && user) {
        console.log("🎉 Immediate session received");
        
        // Create profile
        try {
          const { error: profileError } = await supabase
            .from("profiles")
            .upsert({
              id: user.id,
              email: formValues.email.trim(),
              full_name: formValues.name,
              role: "teacher",
              coins: 100, // Initial coins
              updated_at: new Date().toISOString(),
            });

          if (profileError) {
            console.warn("⚠️ Profile creation warning:", profileError);
          }
        } catch (profileError) {
          console.warn("⚠️ Profile creation optional error:", profileError);
        }

        // Show scratch card after a brief delay
        setTimeout(() => {
          setShowScratchCard(true);
        }, 1000);

        return;
      }

      // Case 3: Email confirmation pending
      toast({
        title: "Almost there!",
        description: "Please check your email to verify your account.",
      });
      navigate("/login?message=verify-email");

    } catch (error: any) {
      console.error("💥 Signup failed:", error);
      
      let errorMessage = "Please try again.";
      
      if (error?.message?.includes("already registered")) {
        errorMessage = "This email is already registered. Try logging in instead.";
      } else if (error?.message?.includes("password")) {
        errorMessage = "Password should be at least 6 characters.";
      } else if (error?.message?.includes("email")) {
        errorMessage = "Please enter a valid email address.";
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Signup failed",
        description: errorMessage,
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
      console.log("🔄 Starting Google OAuth...");
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { 
            access_type: "offline", 
            prompt: "consent" 
          },
        },
      });
      
      if (error) {
        console.error("❌ Google OAuth error:", error);
        throw error;
      }
      
      console.log("✅ Google OAuth initiated successfully");
      
    } catch (error: any) {
      console.error("💥 Google signup failed:", error);
      
      let errorMessage = "Please try again.";
      if (error?.message?.includes("popup")) {
        errorMessage = "Popup blocked. Please allow popups for this site.";
      }
      
      toast({
        title: "Google signup failed",
        description: errorMessage,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const closeScratchCard = () => {
    setShowScratchCard(false);
    navigate("/dashboard?newUser=true", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-[#DFE4EF] relative">
      {/* Confetti Effect */}
      <AnimatePresence>
        {coinsScratched && <Confetti />}
      </AnimatePresence>

      {/* Scratch Card Modal */}
      <AnimatePresence>
        {showScratchCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl p-8 max-w-md w-full mx-auto"
            >
              <div className="text-center text-white">
                <h2 className="text-3xl font-bold mb-4">🎉 Welcome Bonus! 🎉</h2>
                <p className="text-lg mb-6">Scratch to reveal your FREE coins!</p>
                
                {/* Scratch Card */}
                <div 
                  className="relative bg-gradient-to-br from-amber-200 to-yellow-300 rounded-2xl p-8 cursor-pointer mx-auto max-w-xs"
                  onMouseMove={handleScratch}
                  onClick={handleScratch}
                >
                  {/* Scratchable Layer */}
                  <div 
                    className="absolute inset-0 bg-gradient-to-br from-gray-400 to-gray-600 rounded-2xl transition-all duration-300"
                    style={{ 
                      clipPath: `inset(0 0 ${100 - scratchProgress}% 0)`,
                      WebkitMask: `linear-gradient(black, black) content-box, linear-gradient(black, black)`,
                      WebkitMaskComposite: 'xor'
                    }}
                  />
                  
                  {/* Revealed Content */}
                  <div className="text-center">
                    <div className="text-4xl font-bold text-gray-800 mb-2">100</div>
                    <div className="text-2xl font-bold text-gray-800 mb-4">FREE COINS</div>
                    <div className="text-sm text-gray-600">
                      {coinsScratched ? "🎊 Congratulations!" : "Scratch to reveal!"}
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-sm text-white/90 bg-white/20 rounded-lg p-3">
                  <p>✨ <strong>Use these coins in contests</strong> to win amazing prizes!</p>
                  <p className="text-xs mt-1">Create test papers, join competitions & more!</p>
                </div>

                <Button
                  onClick={closeScratchCard}
                  className="mt-6 bg-white text-orange-600 hover:bg-gray-100 font-bold py-3 px-8 rounded-full"
                >
                  Start Creating! 🚀
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left: form card */}
      <div className="flex flex-1 flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md">
          {/* Welcome Bonus Banner */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-4 mb-6 text-white text-center shadow-lg"
          >
            <div className="flex items-center justify-center gap-3">
              <div className="text-2xl">🎁</div>
              <div>
                <h3 className="font-bold text-lg">Get 100 FREE Coins!</h3>
                <p className="text-sm opacity-90">Sign up now & scratch to win</p>
              </div>
            </div>
          </motion.div>

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
                    disabled={isLoading}
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
                    disabled={isLoading}
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
                    minLength={6}
                    value={formValues.password}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="mt-1 bg-gray-50/80 border-gray-300 focus:bg-white focus:ring-2 focus:ring-blue-500/40"
                  />
                  <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters long</p>
                </div>

                <div className="flex items-center">
                  <Checkbox
                    id="acceptTerms"
                    name="acceptTerms"
                    checked={formValues.acceptTerms}
                    onCheckedChange={(checked) =>
                      setFormValues((s) => ({ ...s, acceptTerms: checked as boolean }))
                    }
                    disabled={isLoading}
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
                             bg-gradient-to-r from-green-600 to-emerald-700 
                             shadow-[0_8px_24px_rgba(34,197,94,0.3)]
                             hover:from-green-700 hover:to-emerald-800
                             active:from-green-800 active:to-emerald-900
                             transition-all duration-300"
                >
                  {isLoading ? "Creating account..." : "🎁 Get FREE Coins!"}
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
            <p className="text-lg text-gray-700 mb-6">
              Create customized, high-quality test papers in minutes using the power of AI.
            </p>
            
            {/* Bonus Features List */}
            <div className="bg-white/80 rounded-2xl p-6 shadow-lg">
              <h3 className="font-bold text-lg text-gray-900 mb-4">🎊 Signup Benefits:</h3>
              <ul className="text-left space-y-3 text-gray-700">
                <li className="flex items-center gap-3">
                  <span className="text-green-600">✅</span>
                  <span><strong>100 FREE coins</strong> to get started</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-green-600">✅</span>
                  <span>Use coins in <strong>contests & competitions</strong></span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-green-600">✅</span>
                  <span>Create unlimited <strong>AI test papers</strong></span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-green-600">✅</span>
                  <span>Win amazing <strong>prizes & rewards</strong></span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;