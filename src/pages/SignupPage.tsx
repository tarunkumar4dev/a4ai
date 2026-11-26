import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { isInAppBrowser, IN_APP_BROWSER_MESSAGE, rememberPassword, normalizeIndianPhone, INVALID_PHONE_MESSAGE, OTP_SENT_MESSAGE, friendlyOtpError } from "@/lib/authHelpers";
import OtpHelp from "@/components/auth/OtpHelp";
import { useAuth } from "@/providers/AuthProvider";
import {
  Eye, EyeOff, User, Mail, ArrowLeft,
  GraduationCap, School, Building2,
  CheckCircle2, MailCheck
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
import { redirectToHome } from "@/lib/homeRoute";

type Role = "student" | "teacher" | "institute";

const VALID_ROLES: Role[] = ["student", "teacher", "institute"];
const isValidRole = (r: string | null): r is Role => !!r && VALID_ROLES.includes(r as Role);

const formatPhoneForIndia = (phone: string): string => normalizeIndianPhone(phone) || phone.trim();

const ROLES = [
  { id: "student" as Role, title: "Student", icon: GraduationCap, color: "text-blue-500", bg: "bg-blue-50", ring: "ring-blue-200", desc: "Contests, practice & flashcards" },
  { id: "teacher" as Role, title: "Teacher", icon: School, color: "text-slate-900", bg: "bg-slate-50", ring: "ring-slate-200", desc: "Tests, copy checking & classes" },
  { id: "institute" as Role, title: "Institute", icon: Building2, color: "text-green-600", bg: "bg-green-50", ring: "ring-green-200", desc: "Batches, staff & attendance" },
];

export default function SignupPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { session, role: existingRole } = useAuth();

  // Role from ?role= query param (deep link / role-picker step)
  const roleParam = searchParams.get("role");
  const selectedRole: Role | null = isValidRole(roleParam) ? roleParam : null;

  const [isLoading, setIsLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [signupMethod, setSignupMethod] = useState<"email" | "phone">("email");

  // Phone OTP states
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [timer, setTimer] = useState(0);
  const [otpSentAt, setOtpSentAt] = useState(0);

  // Security
  const formMountTime = useRef(Date.now());
  const [honeypot, setHoneypot] = useState("");
  const [requiresCaptcha, setRequiresCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);

  const [formValues, setFormValues] = useState({
    name: "", email: "", password: "", confirmPassword: "", acceptTerms: false, phone: "",
    instituteName: "",
  });

  // If already logged in, redirect via the shared helper
  useEffect(() => {
    if (session) { void redirectToHome(navigate, existingRole); }
  }, [session, existingRole, navigate]);

  // Timer countdown
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timer > 0) interval = setInterval(() => setTimer((p) => p - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Persistent OTP Cooldown Check
  useEffect(() => {
    if (signupMethod === "phone" && formValues.phone) {
      const cd = RateLimiter.getOtpCooldownSeconds(formValues.phone);
      if (cd > 0) { setTimer(cd); setOtpSent(true); }
    }
  }, [signupMethod, formValues.phone]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormValues((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };

  const pickRole = (role: Role) => {
    setSearchParams({ role }, { replace: false });
    formMountTime.current = Date.now();
  };

  const goBackToRolePicker = () => {
    setSearchParams({}, { replace: false });
  };

  // ── OAuth redirect URL with role encoded ──
  const oauthRedirectUrl = (role: Role) =>
    `${window.location.origin}/auth/callback?signup_role=${role}`;

  // ── Send OTP ──
  const sendOtp = async () => {
    const phoneRaw = formValues.phone.trim();
    if (!phoneRaw || !normalizeIndianPhone(phoneRaw)) {
      toast({ title: "Invalid number", description: INVALID_PHONE_MESSAGE, variant: "destructive" });
      return;
    }
    const wafCheck = WAF.inspectPayload({ phone: phoneRaw, honeypot });
    if (!wafCheck.isSafe) {
      toast({ title: "Something in the form isn't allowed", description: "Remove unusual characters and try again.", variant: "destructive" });
      return;
    }
    const otpCheck = RateLimiter.checkOtpLimit(phoneRaw);
    if (!otpCheck.allowed) {
      toast({ title: "Please wait before asking for another OTP", description: otpCheck.reason || "Please wait.", variant: "destructive" });
      if (otpCheck.retryAfterSec > 0 && otpCheck.retryAfterSec <= 60) setTimer(otpCheck.retryAfterSec);
      return;
    }
    if (requiresCaptcha && !captchaToken) {
      toast({ title: "One quick check", description: "Complete the check below, then continue.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: formatPhoneForIndia(phoneRaw) });
      if (error) throw error;
      RateLimiter.recordOtpSent(phoneRaw);
      setOtp("");
      setOtpSent(true);
      setOtpSentAt(Date.now());
      setTimer(60);
      toast({ title: "OTP sent", description: OTP_SENT_MESSAGE });
    } catch (error: unknown) {
      toast({ title: "Could not send OTP", description: friendlyOtpError((error as Error).message), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Google Signup ──
  const handleGoogleSignup = async () => {
    if (!selectedRole) return;
    if (isInAppBrowser()) {
      toast({ title: "Switch browser", description: IN_APP_BROWSER_MESSAGE, variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      // Primary: role in the redirect URL. Belt-and-suspenders: also in localStorage.
      localStorage.setItem("a4ai_pending_role", selectedRole);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: oauthRedirectUrl(selectedRole),
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      toast({ title: "Google signup failed", description: (error as Error).message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  // ── After signup: institute role → create institute, then redirect ──
  const afterSignup = async (role: Role) => {
    if (role === "institute" && formValues.instituteName.trim()) {
      try {
        const { error } = await supabase.rpc("create_institute", { p_name: formValues.instituteName.trim() });
        if (error) {
          const msg = (error.message || "").toLowerCase();
          if (msg.includes("duplicate") || msg.includes("slug") || msg.includes("unique")) {
            toast({ title: "Name taken", description: "Try a different institute name.", variant: "destructive" });
          } else {
            console.warn("create_institute failed:", error.message);
          }
        }
      } catch { /* non-fatal: user lands on /institute and can create it there */ }
      // Full reload so get_my_access picks up the new admin role
      window.location.assign("/institute");
      return;
    }
    await redirectToHome(navigate, role);
  };

  // ── updateUser with one retry (for phone OTP path) ──
  const updateUserRoleWithRetry = async (role: Role) => {
    const attempt = () => supabase.auth.updateUser({ data: { role } });
    const { error } = await attempt();
    if (error) {
      await new Promise((r) => setTimeout(r, 1000));
      const { error: e2 } = await attempt();
      if (e2) {
        navigate("/select-role", { replace: true });
        return false;
      }
    }
    return true;
  };

  // ── Submit (Email or Phone OTP) ──
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    const currentRole = selectedRole;

    const wafCheck = WAF.inspectPayload({ name: formValues.name, email: formValues.email, password: formValues.password, phone: formValues.phone, honeypot });
    if (!wafCheck.isSafe) {
      toast({ title: "Something in the form isn't allowed", description: "Remove unusual characters and try again.", variant: "destructive" });
      return;
    }
    const rlCheck = RateLimiter.checkRateLimit("signup_attempt", 5, 10 * 60 * 1000);
    if (!rlCheck.allowed) {
      toast({ title: "Too many tries", description: `Please try again in ${rlCheck.retryAfterSec} seconds.`, variant: "destructive" });
      return;
    }
    const identifier = signupMethod === "email" ? formValues.email.trim() : formValues.phone.trim();
    const risk = RiskEngine.evaluateRisk({ identifier, formMountTimestamp: formMountTime.current, honeypotValue: honeypot });
    if (risk.requiresCaptcha && !captchaToken) {
      setRequiresCaptcha(true);
      toast({ title: "One quick check", description: "Complete the check below, then sign up.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      if (signupMethod === "email") {
        if (formValues.password !== formValues.confirmPassword) {
          toast({ title: "Passwords don't match", variant: "destructive" }); setIsLoading(false); return;
        }
        if (!formValues.acceptTerms) {
          toast({ title: "Accept terms to continue", variant: "destructive" }); setIsLoading(false); return;
        }
        if (currentRole === "institute" && !formValues.instituteName.trim()) {
          toast({ title: "Enter your institute name", variant: "destructive" }); setIsLoading(false); return;
        }

        const metadata: Record<string, string> = { full_name: formValues.name, role: currentRole };
        if (currentRole === "institute") metadata.institute_name = formValues.instituteName.trim();
        const { data, error } = await supabase.auth.signUp({
          email: formValues.email.trim(),
          password: formValues.password,
          options: {
            data: metadata,
            emailRedirectTo: oauthRedirectUrl(currentRole),
          },
        });
        if (error) throw error;
        if (data.session) {
          RiskEngine.recordSuccess(identifier);
          await rememberPassword(formValues.email.trim(), formValues.password, formValues.name);
          await afterSignup(currentRole);
        } else {
          if (currentRole === "institute" && formValues.instituteName.trim()) {
            localStorage.setItem("a4ai_pending_institute_name", formValues.instituteName.trim());
          }
          setEmailVerificationSent(true);
          toast({ title: "Verification Email Sent", description: "Click the confirmation link sent to your inbox." });
        }
      } else {
        const otpCode = otp.trim();
        if (otpCode.length !== 6) {
          toast({ title: "Enter 6-digit OTP", variant: "destructive" }); setIsLoading(false); return;
        }
        const { data, error } = await supabase.auth.verifyOtp({
          phone: formatPhoneForIndia(formValues.phone),
          token: otpCode,
          type: "sms",
        });
        if (error) throw error;
        if (data.user && !data.user.user_metadata?.role) {
          const ok = await updateUserRoleWithRetry(currentRole);
          if (!ok) return;
        }
        RiskEngine.recordSuccess(identifier);
        await afterSignup(currentRole);
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

  // ── STEP 1: Role Picker ──
  const renderRolePicker = () => (
    <div className="w-full max-w-[440px] mx-auto rounded-[24px] border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgba(17,17,17,0.06)] flex flex-col">
      <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className="mb-4 -ml-2 rounded-full w-fit text-[#5D6570] hover:bg-[#F7F8FA]">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In
      </Button>

      <div className="mb-6">
        <h1 className="font-halenoir text-3xl sm:text-4xl font-bold tracking-[-0.02em] text-[#1B1B1B]">Who are you?</h1>
        <p className="text-sm text-slate-500 mt-2">Choose your role to get started</p>
      </div>

      <div className="space-y-3">
        {ROLES.map((r) => (
          <button
            key={r.id}
            onClick={() => pickRole(r.id)}
            className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left hover:shadow-md hover:border-[#111111] bg-white border-[#E5E7EB]`}
          >
            <div className={`w-12 h-12 ${r.bg} rounded-xl flex items-center justify-center shrink-0`}>
              <r.icon className={`w-6 h-6 ${r.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-slate-900">{r.title}</p>
              <p className="text-[12px] text-slate-500 mt-0.5">{r.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <p className="text-center text-sm font-medium text-slate-600 mt-6">
        Already have an account?{" "}
        <Link to="/login" className="font-bold text-black hover:underline">Sign in</Link>
      </p>
    </div>
  );

  // ── STEP 2: Signup Form (scoped to selectedRole) ──
  const renderForm = () => {
    const roleMeta = ROLES.find((r) => r.id === selectedRole)!;

    return (
      <div className="w-full max-w-[440px] mx-auto rounded-[24px] border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgba(17,17,17,0.06)] flex flex-col">
        <Button variant="ghost" size="sm" onClick={goBackToRolePicker} className="mb-4 -ml-2 rounded-full w-fit text-[#5D6570] hover:bg-[#F7F8FA]">
          <ArrowLeft className="w-4 h-4 mr-2" /> Change role
        </Button>

        <div className="mb-5">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-9 h-9 ${roleMeta.bg} rounded-lg flex items-center justify-center`}>
              <roleMeta.icon className={`w-4.5 h-4.5 ${roleMeta.color}`} />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{roleMeta.title} Account</span>
          </div>
          <h1 className="font-halenoir text-3xl sm:text-4xl font-bold tracking-[-0.02em] text-[#1B1B1B]">Create Account</h1>
        </div>

        <div className="space-y-4">
          {/* Google Signup */}
          <Button
            variant="outline"
            onClick={handleGoogleSignup}
            disabled={isLoading}
            className="w-full h-12 rounded-2xl font-bold gap-3 text-sm bg-white border-[#E5E7EB] text-[#1B1B1B] hover:bg-[#F7F8FA]"
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
            {/* Bot Honeypot */}
            <div className="hidden" aria-hidden="true" style={{ display: "none" }}>
              <input type="text" name="website_hp" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" />
            </div>

            {/* Email Verification Sent */}
            {emailVerificationSent && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 flex items-start gap-3 text-xs mb-4">
                <MailCheck className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
                <div>
                  <p className="font-bold text-sm">Verify Your Email Address</p>
                  <p className="mt-1 opacity-90 leading-relaxed">
                    We have sent a verification link to <strong>{formValues.email}</strong>. Check your inbox and click the link to activate your account.
                  </p>
                  <Link to="/login" className="inline-block mt-2 font-bold underline text-emerald-800">Go to Sign In &rarr;</Link>
                </div>
              </div>
            )}

            {signupMethod === "phone" ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="signup-phone" className="text-[12px] font-semibold text-[#374151] ml-1">Phone Number</Label>
                  <div className="flex gap-2">
                    <Input id="signup-phone" type="tel" name="phone" value={formValues.phone} onChange={onChange} className="h-11 rounded-xl flex-1 bg-white border-[#E5E7EB] text-[#1B1B1B]" placeholder="9593457XXX" maxLength={10} />
                    <Button type="button" onClick={sendOtp} disabled={timer > 0 || isLoading} className="h-11 rounded-xl px-4 text-xs font-bold bg-black text-white hover:bg-slate-900">
                      {timer > 0 ? `Resend (${timer}s)` : "Send OTP"}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Your 10-digit WhatsApp number — the OTP comes on WhatsApp</p>
                </div>
                {otpSent && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between ml-2 mr-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Enter OTP</Label>
                      {otp.length > 0 && (
                        <button type="button" onClick={() => setOtp("")} className="text-[11px] text-slate-400 hover:text-slate-600 font-semibold">Clear</button>
                      )}
                    </div>
                    <div className="flex justify-center w-full">
                      <InputOTP maxLength={6} pattern={REGEXP_ONLY_DIGITS} value={otp} onChange={(val) => setOtp(val)} containerClassName="w-full justify-between">
                        <InputOTPGroup className="flex justify-between w-full gap-2">
                          {[0, 1, 2, 3, 4, 5].map((idx) => (
                            <InputOTPSlot key={idx} index={idx} className="w-10 sm:w-11 h-12 text-center text-lg font-bold rounded-xl border bg-white border-[#E5E7EB] text-slate-900" />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <OtpHelp
                      sentAt={otpSentAt}
                      isDarkMode={false}
                      onGoogle={handleGoogleSignup}
                      onEmail={() => { setSignupMethod("email"); setOtp(""); setOtpSent(false); setOtpSentAt(0); }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Institute Name — only for institute signup */}
                {selectedRole === "institute" && (
                  <div className="space-y-1">
                    <Label htmlFor="signup-institute" className="text-[12px] font-semibold text-[#374151] ml-1">Institute Name</Label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input id="signup-institute" name="instituteName" required value={formValues.instituteName} onChange={onChange} className="h-11 rounded-xl pl-11 bg-white border-[#E5E7EB] text-[#1B1B1B]" placeholder="Delhi Public School" />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <Label htmlFor="signup-name" className="text-[12px] font-semibold text-[#374151] ml-1">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input id="signup-name" name="name" autoComplete="name" required value={formValues.name} onChange={onChange} className="h-11 rounded-xl pl-11 bg-white border-[#E5E7EB] text-[#1B1B1B]" placeholder="John Doe" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="signup-email" className="text-[12px] font-semibold text-[#374151] ml-1">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input id="signup-email" type="email" name="email" autoComplete="username" required value={formValues.email} onChange={onChange} className="h-11 rounded-xl pl-11 bg-white border-[#E5E7EB] text-[#1B1B1B]" placeholder="john@example.com" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="signup-password" className="text-[12px] font-semibold text-[#374151] ml-1">Password</Label>
                    <div className="relative">
                      <Input id="signup-password" type={showPw ? "text" : "password"} name="password" autoComplete="new-password" required value={formValues.password} onChange={onChange} className="h-11 rounded-xl pr-10 bg-white border-[#E5E7EB] text-[#1B1B1B]" />
                      <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? "Hide password" : "Show password"} className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center text-[#6B7280] hover:text-[#111111]">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="signup-confirm" className="text-[12px] font-semibold text-[#374151] ml-1">Confirm</Label>
                    <div className="relative">
                      <Input id="signup-confirm" type={showConfirmPw ? "text" : "password"} name="confirmPassword" autoComplete="new-password" required value={formValues.confirmPassword} onChange={onChange} className="h-11 rounded-xl pr-10 bg-white border-[#E5E7EB] text-[#1B1B1B]" />
                      <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} aria-label={showConfirmPw ? "Hide password" : "Show password"} className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center text-[#6B7280] hover:text-[#111111]">
                        {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-2 py-2">
                  <Checkbox id="acceptTerms" name="acceptTerms" checked={formValues.acceptTerms} onCheckedChange={(c) => setFormValues((s) => ({ ...s, acceptTerms: Boolean(c) }))} />
                  <label htmlFor="acceptTerms" className="text-[11px] font-medium leading-tight text-slate-600">
                    I agree to the <Link to="/terms" className="font-bold underline">Terms</Link> &amp; <Link to="/privacy" className="font-bold underline">Privacy</Link>
                  </label>
                </div>
              </div>
            )}

            <SmartCaptcha required={requiresCaptcha} onVerify={(token) => setCaptchaToken(token)} onReset={() => setCaptchaToken(null)} isDarkMode={false} />

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

            <p className="text-center text-sm font-medium text-slate-600">
              Already have an account?{" "}
              <Link to="/login" className="font-bold text-black hover:underline">Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-white px-4 sm:px-6 overflow-x-hidden">
      <Helmet>
        <title>{selectedRole ? `Create ${selectedRole} account — a4ai` : "Create your account — a4ai"}</title>
        <meta name="description" content="Sign up for a4ai as a student, teacher or institute. Create test papers, check copies and run classes." />
        <link rel="canonical" href="https://a4ai.in/signup" />
      </Helmet>
      <Navbar />

      <main id="main-content" className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-8 lg:gap-12 items-center pt-24 sm:pt-28 pb-10">
        {selectedRole ? renderForm() : renderRolePicker()}

        <div className="hidden lg:flex items-center justify-center p-10 h-[560px] rounded-[28px] bg-[#7CC6FE]">
          <AuthCharacters />
        </div>
      </main>
    </div>
  );
}
