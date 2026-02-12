import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  ArrowLeft, 
  GraduationCap, 
  School, 
  Building2, 
  ChevronDown,
  CheckCircle2,
  Sun,
  Moon,
  Phone
} from "lucide-react";

type Role = "student" | "teacher" | "institute";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");
  const [formValues, setFormValues] = useState({ email: "", password: "", phone: "" });
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [timer, setTimer] = useState(0);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (location.state?.role) setSelectedRole(location.state.role);
    if (location.state?.email) setFormValues(prev => ({ ...prev, email: location.state.email }));
  }, [location.state]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => setPointer({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // Timer Logic for Resend OTP
  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormValues((s) => ({ ...s, [e.target.name]: e.target.value }));

  const handleOtpChange = (value: string, index: number) => {
    if (isNaN(Number(value))) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const sendOtp = async () => {
    if (!formValues.phone) {
      toast({ title: "Error", description: "Enter phone number", variant: "destructive" });
      return;
    }
    setOtpSent(true);
    setTimer(60);
    toast({ title: "OTP Sent", description: "Check your mobile device" });
  };

  const handleGoogleLogin = async () => {
    if (!selectedRole) {
      setIsExpanded(true);
      toast({ title: "Select role first", description: "Choose your role before Google login", variant: "destructive" });
      return;
    }
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
    } catch (error: any) {
      toast({ title: "Google login failed", description: error.message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) {
      setIsExpanded(true);
      return;
    }
    setIsLoading(true);
    try {
      if (loginMethod === "email") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formValues.email.trim(),
          password: formValues.password,
        });
        if (error) throw error;
      }
      navigate("/dashboard", { replace: true });
    } catch (error: any) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const roles = [
    { id: "student", title: "Student", icon: GraduationCap, color: "text-blue-500", desc: "Materials & Tests" },
    { id: "teacher", title: "Teacher", icon: School, color: "text-slate-900", desc: "Manage Classes" },
    { id: "institute", title: "Institute", icon: Building2, color: "text-green-500", desc: "Admin & Reports" }
  ];

  return (
    <div className={`h-screen w-full flex items-center justify-center p-6 font-sans transition-colors duration-500 overflow-hidden ${isDarkMode ? 'bg-[#0f172a]' : 'bg-[#E0E6F7]'}`}>
      
      <button 
        onClick={toggleDarkMode}
        className={`fixed top-8 right-8 p-3 rounded-2xl backdrop-blur-md border transition-all z-50 shadow-lg ${
          isDarkMode ? 'bg-white/10 border-white/20 text-yellow-400 hover:bg-white/20' : 'bg-black/5 border-black/10 text-slate-700 hover:bg-black/10'
        }`}
      >
        {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
      </button>

      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-[460px_1fr] gap-8 items-center relative z-10">
        
        <div className={`backdrop-blur-[30px] saturate-[180%] border rounded-[3rem] shadow-2xl p-10 flex flex-col transition-all duration-500 ${
          isDarkMode ? 'bg-slate-900/60 border-white/10 shadow-black/40' : 'bg-white/40 border-white/50 shadow-slate-300/50'
        }`}>
          
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className={`mb-6 -ml-2 rounded-full w-fit ${isDarkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-600 hover:bg-white/20'}`}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>

          <div className="mb-8">
            <h1 className={`text-4xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Welcome back</h1>
            <p className={`text-sm font-semibold mt-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              New here? <Link to="/signup" className={`font-bold hover:underline ${isDarkMode ? 'text-white' : 'text-black'}`}>Create account</Link>
            </p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <button 
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 ${
                  isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white/30 border-white/50 hover:bg-white/50 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800' : 'bg-white/80 shadow-inner'}`}>
                    {selectedRole === "student" && <GraduationCap className="w-5 h-5 text-blue-500" />}
                    {selectedRole === "teacher" && <School className={`w-5 h-5 ${isDarkMode ? 'text-white' : 'text-black'}`} />}
                    {selectedRole === "institute" && <Building2 className="w-5 h-5 text-green-500" />}
                    {!selectedRole && <div className="w-2 h-2 rounded-full bg-slate-400" />}
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Identity</p>
                    <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{selectedRole || "Select Role"}</p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
              </button>

              <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100 mb-2" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="overflow-hidden space-y-2">
                  {roles.map((r) => (
                    <button 
                      key={r.id}
                      onClick={() => { setSelectedRole(r.id as Role); setIsExpanded(false); }}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border duration-150 ${
                        selectedRole === r.id 
                          ? (isDarkMode ? "bg-white/20 border-white/40" : "bg-white/80 border-black/40 shadow-md scale-[1.01]") 
                          : (isDarkMode ? "bg-white/5 border-white/5 hover:bg-white/10" : "bg-white/10 border-white/10 hover:bg-white/30")
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <r.icon className={`w-5 h-5 ${r.id === 'teacher' ? (isDarkMode ? 'text-white' : 'text-black') : r.color}`} />
                        <div className="text-left">
                          <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{r.title}</p>
                          <p className="text-[10px] font-medium text-slate-500">{r.desc}</p>
                        </div>
                      </div>
                      {selectedRole === r.id && <CheckCircle2 className={`w-4 h-4 ${isDarkMode ? 'text-white' : 'text-black'}`} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button 
              onClick={() => setLoginMethod(loginMethod === "email" ? "phone" : "email")}
              className={`w-full h-12 rounded-2xl font-bold gap-3 text-sm transition-all border ${
                isDarkMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white/40 border-white/50 text-slate-700 hover:bg-white/60 shadow-sm'
              }`}
            >
              <Phone className="w-4 h-4" />
              {loginMethod === "email" ? "Using Mobile Number" : "Using Email Address"}
            </Button>

            <Button 
              variant="outline" 
              onClick={handleGoogleLogin}
              className={`w-full h-12 rounded-2xl font-bold gap-3 text-sm transition-all ${
                isDarkMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white/40 border-white/50 text-slate-700 hover:bg-white/60 shadow-sm'
            }`}>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google Login
            </Button>

            <form onSubmit={onSubmit} className="space-y-4">
              {loginMethod === "email" ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Email</Label>
                    <Input type="email" name="email" value={formValues.email} onChange={onChange} className={`h-11 rounded-xl transition-all ${
                      isDarkMode ? 'bg-white/5 border-white/10 text-white focus:bg-white/10' : 'bg-white/40 border-white/40 focus:bg-white/60'
                    }`} placeholder="name@company.com" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Password</Label>
                    <div className="relative">
                      <Input type={showPw ? "text" : "password"} name="password" value={formValues.password} onChange={onChange} className={`h-11 rounded-xl pr-11 transition-all ${
                        isDarkMode ? 'bg-white/5 border-white/10 text-white focus:bg-white/10' : 'bg-white/40 border-white/40 focus:bg-white/60'
                      }`} placeholder="••••••••" />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Phone Number</Label>
                    <div className="flex gap-2">
                      <Input type="tel" name="phone" value={formValues.phone} onChange={onChange} className={`h-11 rounded-xl flex-1 transition-all ${
                        isDarkMode ? 'bg-white/5 border-white/10 text-white focus:bg-white/10' : 'bg-white/40 border-white/40 focus:bg-white/60'
                      }`} placeholder="+91 00000 00000" />
                      <Button 
                        type="button"
                        onClick={sendOtp}
                        disabled={timer > 0}
                        className={`h-11 rounded-xl px-4 text-xs font-bold transition-all ${
                          isDarkMode ? 'bg-white text-black hover:bg-slate-200' : 'bg-black text-white hover:bg-slate-900'
                        }`}
                      >
                        {timer > 0 ? `Resend (${timer}s)` : "Send OTP"}
                      </Button>
                    </div>
                  </div>
                  {otpSent && (
                    <div className="space-y-1 animate-in zoom-in-95 duration-200">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Enter OTP</Label>
                      <div className="flex justify-between gap-2">
                        {otp.map((digit, idx) => (
                          <input
                            key={idx}
                            id={`otp-${idx}`}
                            type="text"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleOtpChange(e.target.value, idx)}
                            className={`w-10 h-12 text-center text-lg font-bold rounded-xl transition-all border ${
                              isDarkMode ? 'bg-white/5 border-white/10 text-white focus:bg-white/10' : 'bg-white/40 border-white/40 focus:bg-white/60'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="rem" checked={remember} onCheckedChange={(c) => setRemember(Boolean(c))} />
                  <label htmlFor="rem" className={`text-xs font-medium cursor-pointer ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Stay signed in</label>
                </div>
                {loginMethod === "email" && (
                  <Link to="/forgot" className={`text-xs font-bold hover:underline ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Forgot?</Link>
                )}
              </div>

              <Button type="submit" disabled={isLoading} className={`w-full h-14 rounded-[1.5rem] font-bold shadow-lg transition-transform active:scale-[0.98] mt-2 ${
                isDarkMode ? 'bg-white text-black hover:bg-slate-100' : 'bg-black text-white hover:bg-slate-900'
              }`}>
                {isLoading ? "Verifying..." : "Log In"}
              </Button>

              <p className={`text-center text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Don't have an account?{" "}
                <Link to="/signup" className={`font-bold hover:underline ${isDarkMode ? 'text-white' : 'text-black'}`}>Sign up</Link>
              </p>
            </form>
          </div>
        </div>

        <div className={`hidden lg:flex items-center justify-center p-10 h-[600px] rounded-[3.5rem] relative overflow-hidden transition-all duration-500 ${
          isDarkMode ? 'bg-slate-800/40' : 'bg-white/40 shadow-inner'
        }`}>
          <RubberHoseShapes pointer={pointer} isDarkMode={isDarkMode} />
        </div>
      </div>
    </div>
  );
}

function RubberHoseShapes({ pointer, isDarkMode }: { pointer: { x: number; y: number }, isDarkMode: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const getMove = (baseX: number, baseY: number, max = 5) => {
    if (!ref.current) return { x: 0, y: 0 };
    const r = ref.current.getBoundingClientRect();
    const centerX = r.left + baseX * (r.width / 460);
    const centerY = r.top + baseY * (r.height / 330);
    const dx = pointer.x - centerX;
    const dy = pointer.y - centerY;
    const dist = Math.hypot(dx, dy) || 1;
    return { x: (dx / dist) * max, y: (dy / dist) * max };
  };

  const EyeItem = ({ x, y, r=7, pr=3.5, w="#0F0F12", p="#FFF" }: any) => {
    const m = getMove(x, y, 3);
    return (
      <g>
        <circle cx={x} cy={y} r={r} fill={w} />
        <circle cx={x + m.x} cy={y + m.y} r={pr} fill={p} />
      </g>
    );
  };

  return (
    <svg ref={ref} viewBox="0 0 460 330" className="w-full h-full drop-shadow-2xl select-none">
      <ellipse cx="230" cy="305" rx="170" ry="10" fill={isDarkMode ? "#1e293b" : "#cbd5e1"} opacity="0.6" />
      <g>
        <path d="M60 300 A110 110 0 0 1 280 300 L60 300 Z" fill="#FF7A2B" />
        <g transform={`translate(${getMove(170, 270).x}, ${getMove(170, 270).y})`}>
          <EyeItem x={155} y={270} /> <EyeItem x={185} y={270} />
          <path d="M150 282 Q170 294 190 282" stroke="#0F0F12" strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      </g>
      <g>
        <rect x="190" y="110" width="95" height="140" rx="18" fill="#7B48FF" />
        <g transform={`translate(${getMove(240, 145).x}, ${getMove(240, 145).y})`}>
          <EyeItem x={225} y={145} r={6.5} /> <EyeItem x={255} y={145} r={6.5} />
          <path d="M225 160 Q240 168 255 160" stroke="#0F0F12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      </g>
      <g>
        <rect x="280" y="200" width="75" height="90" rx="15" fill="#0F0F12" />
        <g transform={`translate(${getMove(315, 240, 3).x}, ${getMove(315, 240, 3).y})`}>
          <EyeItem x={300} y={240} r={7.5} w="#FFF" p="#0F0F12" /> <EyeItem x={330} y={240} r={7.5} w="#FFF" p="#0F0F12" />
          <line x1="300" y1="255" x2="330" y2="255" stroke="#FFF" strokeWidth="3" strokeLinecap="round" />
        </g>
      </g>
      <g>
        <path d="M320 80 L390 140 L250 140 Z" fill="#4ECDC4" />
        <g transform={`translate(${getMove(320, 120).x}, ${getMove(320, 120).y})`}>
          <EyeItem x={310} y={120} r={5} pr={2} /> <EyeItem x={335} y={120} r={5} pr={2} />
          <path d="M315 130 L323 135 L331 130" stroke="#0F0F12" strokeWidth="2" fill="none" />
        </g>
      </g>
      <g>
        <rect x="350" y="180" width="95" height="110" rx="28" fill="#F2C500" />
        <g transform={`translate(${getMove(400, 220).x}, ${getMove(400, 220).y})`}>
          <EyeItem x={385} y={225} r={7} /> <EyeItem x={415} y={225} r={7} />
          <path d="M385 240 q14 10 28 0" stroke="#0F0F12" strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      </g>
      <g>
        <circle cx="120" cy="110" r="28" fill="#FF6B6B" />
        <g transform={`translate(${getMove(120, 110).x}, ${getMove(120, 110).y})`}>
          <EyeItem x={110} y={105} r={5} pr={2} /> <EyeItem x={130} y={105} r={5} pr={2} />
          <path d="M115 112 a5 5 0 0 0 10 0" fill="#0F0F12" />
        </g>
      </g>
    </svg>
  );
}
