import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { Eye, EyeOff } from "lucide-react";

/** Palette: cloud=#E0E6F7, slate=#5D687B, mist=#D6DEE7 */

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [formValues, setFormValues] = useState({ email: "", password: "" });
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  // pointer for eyes (mouse + touch)
  useEffect(() => {
    const onMove = (e: PointerEvent) => setPointer({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // if you came back from callback with state (legacy), push to dashboard
  useEffect(() => {
    if (location.state?.from === "oauth-callback") {
      navigate("/dashboard", { replace: true });
    }
  }, [location, navigate]);

  // already signed in? go straight to dashboard
  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) navigate("/dashboard", { replace: true });
    };
    check();
  }, [navigate]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormValues((s) => ({ ...s, [e.target.name]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formValues.email.trim(),
        password: formValues.password,
      });
      if (error) throw error;
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

  const google = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      // Redirect flow → page will navigate away; don't reset loading in success path.
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
    <div className="min-h-screen w-full bg-[#E0E6F7]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:[grid-template-columns:480px_1fr]">
          {/* LEFT — compact card */}
          <div className="rounded-2xl sm:rounded-3xl bg-white shadow-xl ring-1 ring-[#D6DEE7] p-5 sm:p-6 md:p-8">
            <p className="text-2xl font-extrabold text-[#5D687B]">Hii,</p>
            <h1 className="mt-1 text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#0f172a]">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              New here?{" "}
              <Link to="/signup" className="font-semibold text-[#5D687B] underline-offset-4 hover:underline">
                Create an account
              </Link>
            </p>

            <div className="mt-6 sm:mt-8 space-y-5 sm:space-y-6">
              <Button
                onClick={google}
                disabled={isLoading}
                variant="outline"
                className="w-full h-11 sm:h-12 justify-center gap-2 rounded-xl border-[#D6DEE7] bg-white text-slate-800 hover:bg-[#F5F7FB]"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign in with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#D6DEE7]" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-slate-500">Or continue with</span>
                </div>
              </div>

              <form onSubmit={onSubmit} className="space-y-4 sm:space-y-5">
                <div>
                  <Label htmlFor="email" className="text-slate-700">Email address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formValues.email}
                    onChange={onChange}
                    className="mt-1 bg-[#F5F7FB] border-[#D6DEE7] focus:bg-white focus:ring-2 focus:ring-[#5D687B]/30"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-slate-700">Password</Label>
                    <Link to="/forgot-password" className="text-sm font-medium text-[#5D687B] hover:underline underline-offset-4">
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
                      onChange={onChange}
                      className="mt-1 bg-[#F5F7FB] border-[#D6DEE7] pr-12 focus:bg-white focus:ring-2 focus:ring-[#5D687B]/30"
                    />
                    <button
                      type="button"
                      aria-label={showPw ? "Hide password" : "Show password"}
                      onClick={() => setShowPw((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox id="remember" checked={remember} onCheckedChange={(c) => setRemember(Boolean(c))} />
                  <label htmlFor="remember" className="text-sm text-slate-700">Remember me</label>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 sm:h-12 rounded-full text-white font-medium bg-[#0f0f12] hover:bg-[#1a1a1e] transition-colors"
                >
                  {isLoading ? "Signing in…" : "Log In"}
                </Button>

                <p className="text-center text-sm text-slate-600">
                  Don’t have an account?{" "}
                  <Link to="/signup" className="font-semibold text-[#0f172a] underline-offset-4 hover:underline">
                    Sign up
                  </Link>
                </p>
              </form>
            </div>
          </div>

          {/* RIGHT — responsive canvas (no fog) */}
          <div className="flex">
            <div className="relative flex-1 rounded-2xl sm:rounded-3xl bg-white shadow-xl ring-1 ring-[#D6DEE7] 
                            p-3 sm:p-4 md:p-6 lg:p-8 flex items-center justify-center
                            h-64 md:h-80 lg:h-[520px]">
              <ShapesWithEyes pointer={pointer} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Shapes (responsive + pointer tracking) ---------------- */
function ShapesWithEyes({ pointer }: { pointer: { x: number; y: number } }) {
  const ref = useRef<SVGSVGElement>(null);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const offset = (cx: number, cy: number, max = 3) => {
    if (!ref.current) return { dx: 0, dy: 0 };
    const r = ref.current.getBoundingClientRect();
    const mx = clamp(pointer.x - r.left, 0, r.width);
    const my = clamp(pointer.y - r.top, 0, r.height);
    const dx = mx - cx;
    const dy = my - cy;
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(max, len) / len;
    return { dx: dx * k, dy: dy * k };
  };

  const EyePair = ({
    x1, x2, y, eyeR = 8, pupilR = 3, eyeFill = "#0F0F12", pupilFill = "#FF7A2B",
  }: { x1: number; x2: number; y: number; eyeR?: number; pupilR?: number; eyeFill?: string; pupilFill?: string }) => {
    const l = offset(x1, y, 3);
    const r = offset(x2, y, 3);
    return (
      <>
        <circle cx={x1} cy={y} r={eyeR} fill={eyeFill} />
        <circle cx={x1 + l.dx} cy={y + l.dy} r={pupilR} fill={pupilFill} />
        <circle cx={x2} cy={y} r={eyeR} fill={eyeFill} />
        <circle cx={x2 + r.dx} cy={y + r.dy} r={pupilR} fill={pupilFill} />
      </>
    );
  };

  const Smile = ({ d, stroke = "#0F0F12", w = 3 }) => (
    <path d={d} stroke={stroke} strokeWidth={w} fill="none" strokeLinecap="round" />
  );

  return (
    <svg ref={ref} viewBox="0 0 460 330" className="h-full w-full max-w-[760px]">
      <ellipse cx="240" cy="300" rx="180" ry="16" fill="#D6DEE7" />

      <path d="M70 300 A115 115 0 0 1 300 300 L70 300 Z" fill="#FF7A2B" />
      <EyePair x1={158} x2={186} y={272} eyeFill="#0F0F12" pupilFill="#FF7A2B" />
      <Smile d="M150 285 Q172 297 194 285" />

      <rect x="190" y="120" width="100" height="138" rx="14" fill="#7B48FF" />
      <EyePair x1={217} x2={241} y={152} eyeR={6.5} pupilR={3} eyeFill="#0F0F12" pupilFill="#7B48FF" />
      <Smile d="M217 168 Q229 174 241 168" w={2.5} />

      <rect x="265" y="200" width="78" height="100" rx="12" fill="#0F0F12" />
      <EyePair x1={288} x2={310} y={238} eyeR={7} pupilR={2.6} eyeFill="#FFFFFF" pupilFill="#0F0F12" />
      <Smile d="M287 254 L311 254" stroke="#FFFFFF" w={3} />

      <rect x="340" y="185" width="105" height="116" rx="28" fill="#F2C500" />
      <EyePair x1={370} x2={394} y={222} eyeR={6} pupilR={2.6} eyeFill="#0F0F12" pupilFill="#F2C500" />
      <Smile d="M374 238 q12 8 24 0" w={4} />

      <circle cx="120" cy="118" r="25" fill="#FF6B6B" />
      <EyePair x1={112} x2={128} y={112} eyeR={4.5} pupilR={2} eyeFill="#0F0F12" pupilFill="#FF6B6B" />
      <path d="M116 124 a8 7 0 1 0 10 0" fill="#0F0F12" />

      <path d="M320 95 L380 145 L260 145 Z" fill="#4ECDC4" />
      <EyePair x1={316} x2={334} y={120} eyeR={4} pupilR={1.6} eyeFill="#0F0F12" pupilFill="#4ECDC4" />
      <polyline points="314,132 319,136 324,132 329,136 334,132" fill="none" stroke="#0F0F12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
