import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { authRedirectUrl, isInAppBrowser, IN_APP_BROWSER_MESSAGE, rememberPassword, normalizeIndianPhone, INVALID_PHONE_MESSAGE, OTP_SENT_MESSAGE, friendlyOtpError } from "@/lib/authHelpers";
import OtpHelp from "@/components/auth/OtpHelp";
import { useAuth } from "@/providers/AuthProvider";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, EyeOff, User, Mail, ArrowLeft, Phone,
  GraduationCap, School, Building2, ChevronDown,
  CheckCircle2, Gift, ShieldAlert, MailCheck
} from "lucide-react";
import { Helmet } from "react-helmet";
import Navbar from "@/components/Navbar";
import AuthCharacters from "@/components/auth/AuthCharacters";
import { RateLimiter } from "@/lib/security/rateLimiter";
import { RiskEngine } from "@/lib/security/riskEngine";
import { WAF } from "@/lib/security/waf";
import { SmartCaptcha } from "@/components/security/SmartCaptcha";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";

type Role = "student" | "teacher" | "institute";

// Format 10-digit Indian number to +91XXXXXXXXXX (shared normaliser; sendOtp validates first)
const formatPhoneForIndia = (phone: string): string => normalizeIndianPhone(phone) || phone.trim();

export default function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { session, role: existingRole } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  // The page is always light (white background); kept as a constant for the shared auth widgets' props.
  const isDarkMode = false;
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [signupMethod, setSignupMethod] = useState<"email" | "phone">("email"); // new accounts: Google or email (no new phone/OTP signups)
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  // Phone OTP states
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [timer, setTimer] = useState(0);
  const [otpSentAt, setOtpSentAt] = useState(0); // restarts the "Didn't get the OTP?" help on every (re)send

  // Security, Bot Honeypot, Risk & Verification States
  const formMountTime = useRef(Date.now());
  const [honeypot, setHoneypot] = useState("");
  const [requiresCaptcha, setRequiresCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);

  // Scratch Card States
  const [showScratchCard, setShowScratchCard] = useState(false);
  const [coinsScratched, setCoinsScratched] = useState(false);
  const [scratchProgress, setScratchProgress] = useState(0);

  const [formValues, setFormValues] = useState({
    name: "", email: "", password: "", confirmPassword: "", acceptTerms: false, phone: "",
  });

  // Check if Mobile Device
  useEffect(() => {
    const checkMobile = () => {
      const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isSmallScreen = window.innerWidth < 768;
      setIsMobileDevice(mobileUA || isSmallScreen);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // If already logged in with role, redirect
  useEffect(() => {
    if (session) {
      const targetRole = (existingRole || selectedRole || "teacher").toLowerCase().trim();
      navigate(`/${targetRole}/dashboard`, { replace: true });
    }
  }, [session, existingRole, selectedRole, navigate]);

  useEffect(() => {
    if (location.state?.role) setSelectedRole(location.state.role);
    if (location.state?.email) setFormValues((p) => ({ ...p, email: location.state.email }));
  }, [location.state]);

  // Timer countdown
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timer > 0) interval = setInterval(() => setTimer((p) => p - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Persistent OTP Cooldown Check (prevents refresh abuse)
  useEffect(() => {
    if (signupMethod === "phone" && formValues.phone) {
      const cd = RateLimiter.getOtpCooldownSeconds(formValues.phone);
      if (cd > 0) {
        setTimer(cd);
        setOtpSent(true);
      }
    }
  }, [signupMethod, formValues.phone]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormValues((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };

  const getInitialCoins = () => {
    if (selectedRole === "student") return 100;
    if (selectedRole === "teacher") return 200;
    return 500;
  };

  const handleScratch = () => {
    if (!coinsScratched) {
      setScratchProgress((prev) => {
        const next = Math.min(prev + 15, 100);
        if (next >= 70 && !coinsScratched) {
          setCoinsScratched(true);
          toast({ title: "Coins Added!", description: `${getInitialCoins()} coins added to your wallet.` });
        }
        return next;
      });
    }
  };

  // ---------- Send OTP (API Cost Control Protected) ----------
  const sendOtp = async () => {
    if (!selectedRole) {
      setIsExpanded(true);
      toast({ title: "Select role first", description: "Choose your role before signing up", variant: "destructive" });
      return;
    }
    const phoneRaw = formValues.phone.trim();
    if (!phoneRaw || !normalizeIndianPhone(phoneRaw)) {
      toast({ title: "Invalid number", description: INVALID_PHONE_MESSAGE, variant: "destructive" });
      return;
    }

    // 1. WAF & Bot Honeypot Check
    const wafCheck = WAF.inspectPayload({ phone: phoneRaw, honeypot });
    if (!wafCheck.isSafe) {
      toast({ title: "Something in the form isn't allowed", description: "Remove unusual characters and try again.", variant: "destructive" });
      return;
    }

    // 2. API Cost Control: Multi-tier OTP limit check (60s cooldown, max 3/hr, max 5/day)
    const otpCheck = RateLimiter.checkOtpLimit(phoneRaw);
    if (!otpCheck.allowed) {
      toast({
        title: "Please wait before asking for another OTP",
        description: otpCheck.reason || "Please wait before requesting another OTP.",
        variant: "destructive",
      });
      if (otpCheck.retryAfterSec > 0 && otpCheck.retryAfterSec <= 60) {
        setTimer(otpCheck.retryAfterSec);
      }
      return;
    }

    // 3. Smart CAPTCHA challenge if risk detected
    if (requiresCaptcha && !captchaToken) {
      toast({
        title: "One quick check",
        description: "Complete the check below, then continue.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: formatPhoneForIndia(phoneRaw),
      });
      if (error) throw error;

      // Record OTP dispatch
      RateLimiter.recordOtpSent(phoneRaw);
      setOtp(""); // a resend invalidates the previous code
      setOtpSent(true);
      setOtpSentAt(Date.now());
      setTimer(60);
      toast({ title: "OTP sent", description: OTP_SENT_MESSAGE });
    } catch (error: unknown) {
      const err = error as Error;
      toast({ title: "Could not send OTP", description: friendlyOtpError(err.message), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // ---------- Google Signup ----------
  const handleGoogleSignup = async () => {
    if (isInAppBrowser()) {
      toast({ title: "Switch browser", description: IN_APP_BROWSER_MESSAGE, variant: "destructive" });
      return;
    }
    if (!selectedRole) {
      setIsExpanded(true);
      toast({ title: "Select role first", description: "Choose your role before signing up", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      localStorage.setItem("a4ai_pending_role", selectedRole);

      const redirectTarget = authRedirectUrl();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTarget,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      const err = error as Error;
      toast({ title: "Google signup failed", description: err.message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  // ---------- Redirect after login ----------
  const redirectAfterLogin = (userRole: string | null | undefined) => {
    const finalRole = (userRole || selectedRole || existingRole || "teacher").toLowerCase().trim();
    navigate(`/${finalRole}/dashboard`, { replace: true });
  };

  // ---------- Submit (Email or Phone OTP) ----------
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) { 
      setIsExpanded(true); 
      return; 
    }

    const currentRole = selectedRole;

    // 1. WAF & Bot Honeypot Check
    const wafCheck = WAF.inspectPayload({
      name: formValues.name,
      email: formValues.email,
      password: formValues.password,
      phone: formValues.phone,
      honeypot,
    });
    if (!wafCheck.isSafe) {
      toast({
        title: "Something in the form isn't allowed",
        description: "Remove unusual characters and try again.",
        variant: "destructive",
      });
      return;
    }

    // 2. Rate Limiting Check
    const rlCheck = RateLimiter.checkRateLimit("signup_attempt", 5, 10 * 60 * 1000);
    if (!rlCheck.allowed) {
      toast({
        title: "Too many tries",
        description: `Please try again in ${rlCheck.retryAfterSec} seconds.`,
        variant: "destructive",
      });
      return;
    }

    // 3. Risk Evaluation
    const identifier = signupMethod === "email" ? formValues.email.trim() : formValues.phone.trim();
    const risk = RiskEngine.evaluateRisk({
      identifier,
      formMountTimestamp: formMountTime.current,
      honeypotValue: honeypot,
    });

    if (risk.requiresCaptcha && !captchaToken) {
      setRequiresCaptcha(true);
      toast({
        title: "One quick check",
        description: "Complete the check below, then sign up.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Email-confirmation link target. Was a native-app deep link on mobile → confirm links were broken on phones.
      const redirectTarget = authRedirectUrl();

      if (signupMethod === "email") {
        if (formValues.password !== formValues.confirmPassword) {
          toast({ title: "Passwords don't match", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        if (!formValues.acceptTerms) {
          toast({ title: "Accept terms to continue", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: formValues.email.trim(),
          password: formValues.password,
          options: {
            data: { full_name: formValues.name, role: currentRole },
            emailRedirectTo: redirectTarget,
          },
        });
        if (error) throw error;
        if (data.session) {
          RiskEngine.recordSuccess(identifier);
          await rememberPassword(formValues.email.trim(), formValues.password, formValues.name);
          const finalRole = (currentRole || "teacher").toLowerCase().trim();
          navigate(`/${finalRole}/dashboard`, { replace: true });
        } else {
          setEmailVerificationSent(true);
          toast({
            title: "Verification Email Sent",
            description: "Please click the confirmation link sent to your inbox to activate your account.",
          });
        }
      } else {
        const otpCode = otp.trim();
        if (otpCode.length !== 6) {
          toast({ title: "Enter 6-digit OTP", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.verifyOtp({
          phone: formatPhoneForIndia(formValues.phone),
          token: otpCode,
          type: "sms",
        });
        if (error) throw error;

        // Only a brand-new account gets the picked role. An existing number signing up again is just a
        // login — don't overwrite their role (e.g. an institute admin becoming "student").
        if (data.user && !data.user.user_metadata?.role) {
          await supabase.auth.updateUser({
            data: { role: currentRole },
          });
        }

        RiskEngine.recordSuccess(identifier);
        redirectAfterLogin(currentRole);
      }
    } catch (error: unknown) {
      const err = error as Error;
      RateLimiter.recordAttempt("signup_attempt", 10 * 60 * 1000);
      const msg = signupMethod === "phone"
        ? friendlyOtpError(err.message)
        : /already registered|already exists/i.test(err.message)
          ? "This email already has an account. Sign in instead — or use Continue with Google if you created it with Google."
          : /password/i.test(err.message) && /(short|least|weak)/i.test(err.message)
            ? "Choose a stronger password (at least 8 characters)."
            : err.message;
      toast({ title: "Signup failed", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const goToDashboard = () => {
    const target = (selectedRole || existingRole || "teacher").toLowerCase().trim();
    navigate(`/${target}/dashboard`, { replace: true });
  };

  const roles = [
    { id: "student", title: "Student", icon: GraduationCap, color: "text-blue-500", desc: "100 Welcome Coins" },
    { id: "teacher", title: "Teacher", icon: School, color: "text-slate-900", desc: "200 Welcome Coins" },
    { id: "institute", title: "Institute", icon: Building2, color: "text-green-500", desc: "500 Welcome Coins" },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-white px-4 sm:px-6 overflow-x-hidden">
      <Helmet>
        <title>Create your account — a4ai</title>
        <meta name="description" content="Sign up for a4ai as a student, teacher or institute. Create test papers, check copies and run classes." />
        <link rel="canonical" href="https://a4ai.in/signup" />
      </Helmet>
      <Navbar />

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
                <motion.div className="absolute inset-0 bg-slate-800 flex items-center justify-center" style={{ clipPath: `circle(${100 - scratchProgress}% at center)` }}>
                  <Gift className="w-12 h-12 text-white animate-bounce" />
                </motion.div>
              </div>
              <Button onClick={goToDashboard} className="mt-10 w-full h-14 rounded-2xl bg-black text-white font-bold hover:bg-slate-900">
                Go to Dashboard
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main id="main-content" className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-8 lg:gap-12 items-center pt-24 sm:pt-28 pb-10">
        <div className="w-full max-w-[440px] mx-auto rounded-[24px] border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgba(17,17,17,0.06)] flex flex-col">
          <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className="mb-4 -ml-2 rounded-full w-fit text-[#5D6570] hover:bg-[#F7F8FA]">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>

          <div className="mb-6">
            <h1 className="font-halenoir text-3xl sm:text-4xl font-bold tracking-[-0.02em] text-[#1B1B1B]">Create Account</h1>
          </div>

          <div className="space-y-4">
            {/* Role Selector */}
            <div className="space-y-2">
              <button type="button" onClick={() => setIsExpanded(!isExpanded)} className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 ${isDarkMode ? "bg-white/5 border-white/10" : "bg-white border-[#E5E7EB]"}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? "bg-slate-800" : "bg-[#F7F8FA]"}`}>
                    {selectedRole === "student" && <GraduationCap className="w-5 h-5 text-blue-500" />}
                    {selectedRole === "teacher" && <School className={`w-5 h-5 ${isDarkMode ? "text-white" : "text-black"}`} />}
                    {selectedRole === "institute" && <Building2 className="w-5 h-5 text-green-500" />}
                    {!selectedRole && <div className="w-2 h-2 rounded-full bg-slate-400" />}
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Identity</p>
                    <p className={`text-sm font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{selectedRole ? selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1) : "Select Role"}</p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
              </button>

              <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100 mb-2" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="overflow-hidden space-y-2">
                  {roles.map((r) => (
                    <button key={r.id} onClick={() => { setSelectedRole(r.id as Role); setIsExpanded(false); }} className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border duration-150 ${selectedRole === r.id ? (isDarkMode ? "bg-white/20 border-white/40" : "bg-white border-[#111111]") : (isDarkMode ? "bg-white/5 border-white/5 hover:bg-white/10" : "bg-white border-[#E5E7EB] hover:bg-[#F7F8FA]")}`}>
                      <div className="flex items-center gap-4">
                        <r.icon className={`w-5 h-5 ${r.id === "teacher" ? (isDarkMode ? "text-white" : "text-black") : r.color}`} />
                        <div className="text-left">
                          <p className={`text-sm font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>{r.title}</p>
                          <p className="text-[10px] font-medium text-slate-500">{r.desc}</p>
                        </div>
                      </div>
                      {selectedRole === r.id && <CheckCircle2 className={`w-4 h-4 ${isDarkMode ? "text-white" : "text-black"}`} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Google Signup — primary option, all devices (in-app browsers get a hint instead) */}
            <Button
                variant="outline"
                onClick={handleGoogleSignup}
                disabled={isLoading}
                className={`w-full h-12 rounded-2xl font-bold gap-3 text-sm transition-all ${isDarkMode ? "bg-white/5 border-white/10 text-white hover:bg-white/10" : "bg-white border-[#E5E7EB] text-[#1B1B1B] hover:bg-[#F7F8FA]"}`}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </Button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-400/30" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">or sign up with email</span>
              <div className="flex-1 h-px bg-slate-400/30" />
            </div>

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-3">
              {/* Bot Honeypot Trap (Invisible) */}
              <div className="hidden" aria-hidden="true" style={{ display: "none" }}>
                <input
                  type="text"
                  name="website_hp"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {/* Email Verification Sent Alert Banner */}
              {emailVerificationSent && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-start gap-3 text-xs animate-in fade-in duration-300 mb-4">
                  <MailCheck className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="font-bold text-sm">Verify Your Email Address</p>
                    <p className="mt-1 opacity-90 leading-relaxed">
                      We have sent a verification link to <strong>{formValues.email}</strong>. Please check your inbox and click the link to activate your account.
                    </p>
                    <Link to="/login" className="inline-block mt-2 font-bold underline text-emerald-800 dark:text-emerald-200">
                      Go to Sign In &rarr;
                    </Link>
                  </div>
                </div>
              )}

              {signupMethod === "phone" ? (
                /* ── Phone OTP Signup ── */
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-1">
                    <Label htmlFor="signup-phone" className="text-[12px] font-semibold text-[#374151] ml-1">Phone Number</Label>
                    <div className="flex gap-2">
                      <Input
                        id="signup-phone"
                        type="tel"
                        name="phone"
                        value={formValues.phone}
                        onChange={onChange}
                        className={`h-11 rounded-xl flex-1 transition-all ${isDarkMode ? "bg-white/5 border-white/10 text-white focus:bg-white/10" : "bg-white border-[#E5E7EB] text-[#1B1B1B]"}`}
                        placeholder="9593457XXX"
                        maxLength={10}
                      />
                      <Button
                        type="button"
                        onClick={sendOtp}
                        disabled={timer > 0 || isLoading}
                        className={`h-11 rounded-xl px-4 text-xs font-bold transition-all ${isDarkMode ? "bg-white text-black hover:bg-slate-200" : "bg-black text-white hover:bg-slate-900"}`}
                      >
                        {timer > 0 ? `Resend (${timer}s)` : "Send OTP"}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Your 10-digit WhatsApp number — the OTP comes on WhatsApp</p>
                  </div>
                  {otpSent && (
                    <div className="space-y-2 animate-in zoom-in-95 duration-200 pt-2">
                      <div className="flex items-center justify-between ml-2 mr-1">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Enter OTP</Label>
                        {otp.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setOtp("")}
                            className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="flex justify-center w-full">
                        <InputOTP
                          maxLength={6}
                          pattern={REGEXP_ONLY_DIGITS}
                          value={otp}
                          onChange={(val) => setOtp(val)}
                          containerClassName="w-full justify-between"
                        >
                          <InputOTPGroup className="flex justify-between w-full gap-2">
                            {[0, 1, 2, 3, 4, 5].map((idx) => (
                              <InputOTPSlot
                                key={idx}
                                index={idx}
                                className={`w-10 sm:w-11 h-12 text-center text-lg font-bold rounded-xl border transition-all ${
                                  isDarkMode
                                    ? "bg-white/5 border-white/10 text-white focus:bg-white/10"
                                    : "bg-white border-[#E5E7EB] text-slate-900"
                                }`}
                              />
                            ))}
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <OtpHelp
                        sentAt={otpSentAt}
                        isDarkMode={isDarkMode}
                        onGoogle={handleGoogleSignup}
                        onEmail={() => { setSignupMethod("email"); setOtp(""); setOtpSent(false); setOtpSentAt(0); }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* ── Email Signup ── */
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-1">
                    <Label htmlFor="signup-name" className="text-[12px] font-semibold text-[#374151] ml-1">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input id="signup-name" name="name" autoComplete="name" required value={formValues.name} onChange={onChange} className={`h-11 rounded-xl pl-11 ${isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-white border-[#E5E7EB] text-[#1B1B1B]"}`} placeholder="John Doe" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="signup-email" className="text-[12px] font-semibold text-[#374151] ml-1">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input id="signup-email" type="email" name="email" autoComplete="username" required value={formValues.email} onChange={onChange} className={`h-11 rounded-xl pl-11 ${isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-white border-[#E5E7EB] text-[#1B1B1B]"}`} placeholder="john@example.com" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="signup-password" className="text-[12px] font-semibold text-[#374151] ml-1">Password</Label>
                      <div className="relative">
                        <Input 
                          id="signup-password"
                          type={showPw ? "text" : "password"} 
                          name="password" 
                          autoComplete="new-password"
                          required 
                          value={formValues.password} 
                          onChange={onChange} 
                          className={`h-11 rounded-xl pr-10 ${isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-white border-[#E5E7EB] text-[#1B1B1B]"}`} 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPw(!showPw)}
                          aria-label={showPw ? "Hide password" : "Show password"}
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center text-[#6B7280] hover:text-[#111111]"
                        >
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="signup-confirm" className="text-[12px] font-semibold text-[#374151] ml-1">Confirm</Label>
                      <div className="relative">
                        <Input 
                          id="signup-confirm"
                          type={showConfirmPw ? "text" : "password"} 
                          name="confirmPassword" 
                          autoComplete="new-password"
                          required 
                          value={formValues.confirmPassword} 
                          onChange={onChange} 
                          className={`h-11 rounded-xl pr-10 ${isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-white border-[#E5E7EB] text-[#1B1B1B]"}`} 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowConfirmPw(!showConfirmPw)}
                          aria-label={showConfirmPw ? "Hide password" : "Show password"}
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center text-[#6B7280] hover:text-[#111111]"
                        >
                          {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-2">
                    <Checkbox id="acceptTerms" name="acceptTerms" checked={formValues.acceptTerms} onCheckedChange={(c) => setFormValues((s) => ({ ...s, acceptTerms: Boolean(c) }))} />
                    <label htmlFor="acceptTerms" className={`text-[11px] font-medium leading-tight ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                      I agree to the <Link to="/terms" className="font-bold underline">Terms</Link> &amp; <Link to="/privacy" className="font-bold underline">Privacy</Link>
                    </label>
                  </div>
                </div>
              )}

              {/* Risk-based Smart CAPTCHA Challenge */}
              <SmartCaptcha
                required={requiresCaptcha}
                onVerify={(token) => setCaptchaToken(token)}
                onReset={() => setCaptchaToken(null)}
                isDarkMode={isDarkMode}
              />

              <Button 
                type="submit" 
                disabled={isLoading || (requiresCaptcha && !captchaToken)} 
                className={`w-full h-12 rounded-xl font-bold text-base mt-2 bg-[#111111] text-white hover:bg-[#222222] ${requiresCaptcha && !captchaToken ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {isLoading 
                  ? "Creating..." 
                  : requiresCaptcha && !captchaToken 
                  ? "Complete the check to sign up"
                  : signupMethod === "phone" 
                  ? "Verify & Sign Up" 
                  : "Sign Up"}
              </Button>

              <p className={`text-center text-sm font-medium transition-colors ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                Already have an account?{" "}
                <Link to="/login" className={`font-bold hover:underline ${isDarkMode ? "text-white" : "text-black"}`}>Sign in</Link>
              </p>
            </form>
          </div>
        </div>

        <div className="hidden lg:flex items-center justify-center p-10 h-[560px] rounded-[28px] bg-[#7CC6FE]">
          <AuthCharacters />
        </div>
      </main>
    </div>
  );
}
