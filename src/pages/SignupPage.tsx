import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { Confetti } from "@/components/ui/confetti";
import { 
  Eye, 
  EyeOff, 
  User, 
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
  Gift
} from "lucide-react";

type Role = "student" | "teacher" | "institute";

export default function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  
  // Scratch Card States
  const [showScratchCard, setShowScratchCard] = useState(false);
  const [coinsScratched, setCoinsScratched] = useState(false);
  const [scratchProgress, setScratchProgress] = useState(0);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  const [formValues, setFormValues] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  });

  useEffect(() => {
    if (location.state?.role) setSelectedRole(location.state.role);
    if (location.state?.email) setFormValues(prev => ({ ...prev, email: location.state.email }));
  }, [location.state]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => setPointer({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormValues(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleScratch = () => {
    if (!coinsScratched) {
      setScratchProgress(prev => {
        const next = Math.min(prev + 15, 100);
        if (next >= 70 && !coinsScratched) {
          setCoinsScratched(true);
          toast({
            title: "🎉 Coins Added!",
            description: `${getInitialCoins()} coins successfully added to your wallet.`,
          });
        }
        return next;
      });
    }
  };

  const getInitialCoins = () => {
    if (selectedRole === "student") return 100;
    if (selectedRole === "teacher") return 200;
    return 500;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) { setIsExpanded(true); return; }
    if (formValues.password !== formValues.confirmPassword) {
      toast({ title: "Passwords mismatch", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formValues.email.trim(),
        password: formValues.password,
        options: {
          data: { full_name: formValues.name, role: selectedRole },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      if (data.session) {
        setShowScratchCard(true);
      } else {
        toast({ title: "Verify your email", description: "Link sent to your inbox." });
        navigate("/login");
      }
    } catch (error: any) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const roles = [
    { id: "student", title: "Student", icon: GraduationCap, color: "text-blue-500", desc: "100 Welcome Coins" },
    { id: "teacher", title: "Teacher", icon: School, color: "text-slate-900", desc: "200 Welcome Coins" },
    { id: "institute", title: "Institute", icon: Building2, color: "text-green-500", desc: "500 Welcome Coins" }
  ];

  return (
    <div className={`h-screen w-full flex items-center justify-center p-6 font-sans transition-colors duration-500 overflow-hidden ${isDarkMode ? 'bg-[#0f172a]' : 'bg-[#E0E6F7]'}`}>
      
      {coinsScratched && <Confetti />}

      {/* Dark Mode Toggle */}
      <button onClick={toggleDarkMode} className={`fixed top-8 right-8 p-3 rounded-2xl backdrop-blur-md border transition-all z-50 shadow-lg ${isDarkMode ? 'bg-white/10 border-white/20 text-yellow-400' : 'bg-black/5 border-black/10 text-slate-700'}`}>
        {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
      </button>

      {/* Scratch Card Modal */}
      <AnimatePresence>
        {showScratchCard && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl bg-black/40">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-[3rem] p-10 max-w-md w-full text-center shadow-2xl">
              <h2 className="text-3xl font-black text-slate-900 mb-2">Welcome Bonus!</h2>
              <p className="text-slate-500 mb-8 font-medium">Scratch the card to reveal your coins</p>
              
              <div className="relative w-64 h-40 mx-auto bg-slate-100 rounded-3xl overflow-hidden cursor-crosshair border-4 border-slate-50 shadow-inner" onMouseMove={handleScratch} onClick={handleScratch}>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-black text-slate-900">{getInitialCoins()}</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Free Coins</span>
                </div>
                <motion.div 
                  className="absolute inset-0 bg-slate-800 flex items-center justify-center"
                  style={{ clipPath: `circle(${100 - scratchProgress}% at center)` }}
                >
                  <Gift className="w-12 h-12 text-white animate-bounce" />
                </motion.div>
              </div>

              <Button onClick={() => navigate("/dashboard")} className="mt-10 w-full h-14 rounded-2xl bg-black text-white font-bold hover:bg-slate-900">
                Go to Dashboard
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-[460px_1fr] gap-8 items-center relative z-10">
        
        {/* LOGIN CARD */}
        <div className={`backdrop-blur-[30px] saturate-[180%] border rounded-[3rem] shadow-2xl p-10 flex flex-col transition-all duration-500 ${isDarkMode ? 'bg-slate-900/60 border-white/10' : 'bg-white/40 border-white/50 shadow-slate-300/50'}`}>
          
          <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className={`mb-6 -ml-2 rounded-full w-fit ${isDarkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-600 hover:bg-white/20'}`}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>

          <div className="mb-6">
            <h1 className={`text-4xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Create Account</h1>
            <p className={`text-sm font-semibold mt-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Already have an account? <Link to="/login" className={`font-bold hover:underline ${isDarkMode ? 'text-white' : 'text-black'}`}>Sign in</Link>
            </p>
          </div>

          <div className="space-y-4">
            {/* ROLE SELECTOR (Expansion pushing content down) */}
            <div className="space-y-2">
              <button type="button" onClick={() => setIsExpanded(!isExpanded)} className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/30 border-white/50 shadow-sm'}`}>
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
                    <button key={r.id} onClick={() => { setSelectedRole(r.id as Role); setIsExpanded(false); }} className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border duration-150 ${selectedRole === r.id ? (isDarkMode ? "bg-white/20 border-white/40" : "bg-white/80 border-black shadow-md scale-[1.01]") : (isDarkMode ? "bg-white/5 border-white/5 hover:bg-white/10" : "bg-white/10 border-white/10 hover:bg-white/30")}`}>
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

            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input name="name" required value={formValues.name} onChange={onChange} className={`h-11 rounded-xl pl-11 ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white/40 border-white/40'}`} placeholder="John Doe" />
                </div>
              </div>
              
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input type="email" name="email" required value={formValues.email} onChange={onChange} className={`h-11 rounded-xl pl-11 ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white/40 border-white/40'}`} placeholder="john@example.com" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Password</Label>
                  <div className="relative">
                    <Input type={showPw ? "text" : "password"} name="password" required value={formValues.password} onChange={onChange} className={`h-11 rounded-xl pr-10 ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white/40 border-white/40'}`} />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Confirm</Label>
                  <div className="relative">
                    <Input type={showConfirmPw ? "text" : "password"} name="confirmPassword" required value={formValues.confirmPassword} onChange={onChange} className={`h-11 rounded-xl pr-10 ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white/40 border-white/40'}`} />
                    <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 px-2 py-2">
                <Checkbox id="acceptTerms" name="acceptTerms" checked={formValues.acceptTerms} onCheckedChange={(c) => setFormValues(s => ({ ...s, acceptTerms: Boolean(c) }))} />
                <label htmlFor="acceptTerms" className={`text-[11px] font-medium leading-tight ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  I agree to the <Link to="#" className="font-bold underline">Terms</Link> & <Link to="#" className="font-bold underline">Privacy</Link>
                </label>
              </div>

              <Button type="submit" disabled={isLoading} className={`w-full h-14 rounded-[1.5rem] font-bold shadow-lg transition-transform active:scale-[0.98] ${isDarkMode ? 'bg-white text-black hover:bg-slate-100' : 'bg-black text-white hover:bg-slate-900'}`}>
                {isLoading ? "Creating..." : "🎁 Get FREE Coins!"}
              </Button>
            </form>
          </div>
        </div>

        {/* CHARACTER SECTION */}
        <div className={`hidden lg:flex items-center justify-center p-10 h-[600px] rounded-[3.5rem] transition-all duration-500 ${isDarkMode ? 'bg-slate-800/40' : 'bg-white/40 shadow-inner'}`}>
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
