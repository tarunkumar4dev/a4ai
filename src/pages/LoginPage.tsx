import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { authRedirectUrl, PHONE_OTP_ENABLED, isInAppBrowser, IN_APP_BROWSER_MESSAGE, GOOGLE_ACCOUNT_HINT, rememberPassword, takeRedirectAfterLogin, normalizeIndianPhone, INVALID_PHONE_MESSAGE, OTP_SENT_MESSAGE, friendlyOtpError } from "@/lib/authHelpers";
import OtpHelp from "@/components/auth/OtpHelp";
import { useAuth } from "@/providers/AuthProvider";
import { Eye, EyeOff, ArrowLeft, Lock } from "lucide-react";
import Navbar from "@/components/Navbar";
import AuthCharacters from "@/components/auth/AuthCharacters";
import { Helmet } from "react-helmet";
import { RateLimiter } from "@/lib/security/rateLimiter";
import { RiskEngine } from "@/lib/security/riskEngine";
import { WAF } from "@/lib/security/waf";
import { SmartCaptcha } from "@/components/security/SmartCaptcha";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";

// Format 10-digit Indian number to +91XXXXXXXXXX (shared normaliser; sendOtp validates first)
const formatPhoneForIndia = (phone: string): string => normalizeIndianPhone(phone) || phone.trim();

export default function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, role } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email"); // Google + email first; mobile OTP only for older phone accounts
  const [formValues, setFormValues] = useState({ email: "", password: "", phone: "" });
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [timer, setTimer] = useState(0);
  const [otpSentAt, setOtpSentAt] = useState(0); // restarts the "Didn't get the OTP?" help on every (re)send
  // The page is always light (white background); kept as a constant for the shared auth widgets' props.
  const isDarkMode = false;
  const [formError, setFormError] = useState("");
  const [shakeSignal, setShakeSignal] = useState(0); // +1 on a confirmed wrong password → characters shake "no"

  // Security, Bot Honeypot, Risk & Lockout States
  const formMountTime = useRef(Date.now());
  const [honeypot, setHoneypot] = useState("");
  const [requiresCaptcha, setRequiresCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [lockoutSec, setLockoutSec] = useState(0);

  // Detect Mobile Device / Screen width on mount
  useEffect(() => {
    const checkMobile = () => {
      const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isSmallScreen = window.innerWidth < 768;
      const mobile = mobileUA || isSmallScreen;
      
      setIsMobileDevice(mobile);
      if (mobile && PHONE_OTP_ENABLED) {
        setLoginMethod("phone");
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (session) {
      const checkAccess = async () => {
        try {
          const { data } = await supabase.rpc('get_my_access');
          const access = data?.[0];
          navigate(access?.home_route || '/dashboard', { replace: true });
        } catch {
          const targetRole = (role || "teacher").toLowerCase().trim();
          navigate(`/${targetRole}/dashboard`, { replace: true });
        }
      };
      checkAccess();
    }
  }, [session, role, navigate]);

  // OTP Timer countdown
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timer > 0) interval = setInterval(() => setTimer((p) => p - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Lockout countdown timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (lockoutSec > 0) {
      interval = setInterval(() => setLockoutSec((p) => (p > 0 ? p - 1 : 0)), 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutSec]);

  // Check lockout and OTP cooldown when user inputs change
  useEffect(() => {
    const identifier = loginMethod === "email" ? formValues.email.trim() : formValues.phone.trim();
    if (identifier) {
      const status = RiskEngine.getLockoutStatus(identifier);
      if (status.isLocked) {
        setLockoutSec(status.remainingSec);
      }
      if (status.failedAttempts >= 2) {
        setRequiresCaptcha(true);
      }
    }
    if (loginMethod === "phone" && formValues.phone) {
      const remainingCooldown = RateLimiter.getOtpCooldownSeconds(formValues.phone);
      if (remainingCooldown > 0) {
        setTimer(remainingCooldown);
        setOtpSent(true);
      }
    }
  }, [loginMethod, formValues.email, formValues.phone]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues((s) => ({ ...s, [e.target.name]: e.target.value }));
    if (formError) setFormError("");
  };

  // ---------- AUTH METHODS ----------

  const sendOtp = async () => {
    const phoneRaw = formValues.phone.trim();
    if (!phoneRaw) {
      toast({ title: "Error", description: "Enter phone number", variant: "destructive" });
      return;
    }
    if (!normalizeIndianPhone(phoneRaw)) {
      toast({ title: "Invalid number", description: INVALID_PHONE_MESSAGE, variant: "destructive" });
      return;
    }

    // 1. WAF & Honeypot Check
    const wafCheck = WAF.inspectPayload({ phone: phoneRaw, honeypot });
    if (!wafCheck.isSafe) {
      toast({ title: "Something in the form isn't allowed", description: "Remove unusual characters and try again.", variant: "destructive" });
      return;
    }

    // 2. Lockout Check
    const lockoutStatus = RiskEngine.getLockoutStatus(phoneRaw);
    if (lockoutStatus.isLocked) {
      setLockoutSec(lockoutStatus.remainingSec);
      toast({
        title: "Too many tries",
        description: `Please try again in ${RiskEngine.formatTime(lockoutStatus.remainingSec)}.`,
        variant: "destructive",
      });
      return;
    }

    // 3. API Cost Control: OTP Rate Limit check
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

    // 4. Smart CAPTCHA requirement if risk detected
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

      // Record successful OTP dispatch in rate limiter
      RateLimiter.recordOtpSent(phoneRaw);
      setOtp(""); // a resend invalidates the previous code
      setOtpSent(true);
      setOtpSentAt(Date.now());
      setTimer(60);
      toast({ title: "OTP sent", description: OTP_SENT_MESSAGE });
    } catch (error: unknown) {
      const err = error as Error;
      RiskEngine.recordFailure(phoneRaw);
      toast({ title: "Could not send OTP", description: friendlyOtpError(err.message), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isInAppBrowser()) {
      toast({ title: "Switch browser", description: IN_APP_BROWSER_MESSAGE, variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
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
      toast({ title: "Google login failed", description: err.message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  const redirectAfterLogin = async () => {
    const back = takeRedirectAfterLogin(); // e.g. the test paper page that opened the login modal
    if (back) {
      navigate(back, { replace: true });
      return;
    }
    try {
      const { data } = await supabase.rpc('get_my_access');
      const access = data?.[0];
      navigate(access?.home_route || '/dashboard', { replace: true });
    } catch (err) {
      console.error("Failed to get_my_access:", err);
      navigate('/dashboard', { replace: true });
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const identifier = loginMethod === "email" ? formValues.email.trim() : formValues.phone.trim();
    if (!identifier) {
      toast({ title: "Error", description: `Please enter your ${loginMethod}`, variant: "destructive" });
      return;
    }

    // 1. Check if account is in temporary lockout
    if (lockoutSec > 0) {
      toast({
        title: "Please wait",
        description: `You can try again in ${RiskEngine.formatTime(lockoutSec)}.`,
        variant: "destructive",
      });
      return;
    }

    // 2. WAF & Bot Honeypot Check
    const wafCheck = WAF.inspectPayload({
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

    // 3. Sliding-window Rate Limit Check
    const rlCheck = RateLimiter.checkRateLimit(`login_${identifier}`, 5, 5 * 60 * 1000);
    if (!rlCheck.allowed) {
      toast({
        title: "Too many tries",
        description: `Please try again in ${rlCheck.retryAfterSec} seconds.`,
        variant: "destructive",
      });
      return;
    }

    // 4. Evaluate Dynamic Risk
    const risk = RiskEngine.evaluateRisk({
      identifier,
      formMountTimestamp: formMountTime.current,
      honeypotValue: honeypot,
    });

    if (risk.requiresCaptcha && !captchaToken) {
      setRequiresCaptcha(true);
      toast({
        title: "One quick check",
        description: "Complete the check below, then sign in.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setFormError("");
    let wrongPassword = false;
    try {
      if (loginMethod === "email") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formValues.email.trim(),
          password: formValues.password,
        });
        if (error) {
          // Google-created accounts have no password → say so instead of a bare "Invalid login credentials"
          // Only a confirmed wrong email/password shakes the characters; rate limits,
          // network and server errors show the message alone.
          const code = (error as { code?: string }).code;
          if (code === "invalid_credentials" || (!code && /invalid login credentials/i.test(error.message))) {
            wrongPassword = true;
            throw new Error(`${error.message}. ${GOOGLE_ACCOUNT_HINT}`);
          }
          if (/email not confirmed/i.test(error.message)) {
            // Send a fresh confirmation link; the old one may have expired.
            await supabase.auth.resend({
              type: "signup",
              email: formValues.email.trim(),
              options: { emailRedirectTo: authRedirectUrl() },
            }).catch(() => undefined);
            throw new Error("Please confirm your email first — we've just sent you a new confirmation link. Check your inbox (and spam).");
          }
          throw error;
        }

        // Reset risk and rate limits on success
        RiskEngine.recordSuccess(identifier);
        RateLimiter.resetAttempts(`login_${identifier}`);
        await rememberPassword(formValues.email.trim(), formValues.password); // browser "save password" prompt
        await redirectAfterLogin();
      } else {
        const otpToken = otp.trim();
        if (otpToken.length !== 6) {
          toast({ title: "Incomplete Code", description: "Please enter the 6-digit OTP", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.verifyOtp({
          phone: formatPhoneForIndia(formValues.phone),
          token: otpToken,
          type: "sms",
        });
        if (error) throw error;

        // Reset risk and rate limits on success
        RiskEngine.recordSuccess(identifier);
        RateLimiter.resetAttempts(`login_${identifier}`);
        await redirectAfterLogin();
      }
    } catch (error: unknown) {
      const err = error as Error;
      if (loginMethod === "phone") err.message = friendlyOtpError(err.message);
      setFormError(wrongPassword ? "Wrong email or password. Try again." : err.message);
      if (wrongPassword) setShakeSignal((n) => n + 1);

      // Record failure in risk engine and rate limiter
      const riskResult = RiskEngine.recordFailure(identifier);
      RateLimiter.recordAttempt(`login_${identifier}`, 5 * 60 * 1000);

      if (riskResult.isLocked) {
        setLockoutSec(riskResult.lockoutRemainingSec);
        toast({
          title: "Too many wrong tries",
          description: `Please try again in ${RiskEngine.formatTime(riskResult.lockoutRemainingSec)}.`,
          variant: "destructive",
        });
      } else if (riskResult.requiresCaptcha) {
        setRequiresCaptcha(true);
        setCaptchaToken(null);
        toast({
          title: "Login failed",
          description: `${err.message} Complete the quick check below to try again.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Login failed", description: err.message, variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-white px-4 sm:px-6 overflow-x-hidden">
      <Helmet>
        <title>Sign in — a4ai</title>
        <meta name="description" content="Sign in to a4ai to create test papers, check copies and manage your classes." />
        <link rel="canonical" href="https://a4ai.in/login" />
      </Helmet>
      <Navbar />

      <main id="main-content" className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-8 lg:gap-12 items-center pt-24 sm:pt-28 pb-10">
        
        {/* -------- CARD -------- */}
        <div className="w-full max-w-[440px] mx-auto rounded-[24px] border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgba(17,17,17,0.06)] flex flex-col">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mb-4 -ml-2 rounded-full w-fit text-[#5D6570] hover:bg-[#F7F8FA]">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>

          {/* HEADER AREA */}
          <div className="mb-6">
            <h1 className="font-halenoir text-3xl sm:text-4xl font-bold tracking-[-0.02em] text-[#1B1B1B]">
              Sign In
            </h1>
          </div>

          <div className="space-y-5">
            {/* Google Login — primary option, all devices (in-app browsers get a hint instead) */}
            <Button
                variant="outline"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full h-12 rounded-xl font-bold gap-3 text-sm bg-white border-[#E5E7EB] text-[#1B1B1B] hover:bg-[#F7F8FA]"
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
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {loginMethod === "email" ? "or sign in with email" : "or use your mobile number"}
              </span>
              <div className="flex-1 h-px bg-slate-400/30" />
            </div>

            {/* FORM AREA */}
            <form onSubmit={onSubmit} className="space-y-4">
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

              {/* Temporary Lockout Alert Banner */}
              {lockoutSec > 0 && (
                <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 flex items-center gap-3 text-xs font-semibold animate-in fade-in duration-200">
                  <Lock className="w-5 h-5 flex-shrink-0 animate-pulse" />
                  <div>
                    <p className="font-bold">Too many wrong tries</p>
                    <p className="font-normal opacity-90">
                      You can try again in {RiskEngine.formatTime(lockoutSec)}.
                    </p>
                  </div>
                </div>
              )}

              {loginMethod === "email" ? (
                /* ── Email Form ── */
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-1">
                    <Label htmlFor="login-email" className="text-[12px] font-semibold text-[#374151] ml-1">Email</Label>
                    <Input id="login-email" type="email" name="email" autoComplete="username" value={formValues.email} onChange={onChange} aria-invalid={Boolean(formError) || undefined} aria-describedby="login-error" className="h-12 rounded-xl bg-white border-[#E5E7EB] text-[#1B1B1B] focus-visible:ring-[#F95D6A]" placeholder="name@company.com" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="login-password" className="text-[12px] font-semibold text-[#374151] ml-1">Password</Label>
                    <div className="relative">
                      <Input id="login-password" type={showPw ? "text" : "password"} name="password" autoComplete="current-password" value={formValues.password} onChange={onChange} aria-invalid={Boolean(formError) || undefined} aria-describedby="login-error" className="h-12 rounded-xl pr-12 bg-white border-[#E5E7EB] text-[#1B1B1B] focus-visible:ring-[#F95D6A]" placeholder="••••••••" />
                      <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? "Hide password" : "Show password"} className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#111111]">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Phone OTP Form ── */
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase ml-2">Phone Number</Label>
                    <div className="flex gap-2">
                      <Input 
                        type="tel" 
                        name="phone" 
                        value={formValues.phone} 
                        onChange={onChange} 
                        className={`h-12 rounded-2xl flex-1 text-base transition-all ${isDarkMode ? "bg-white/5 border-white/10 text-white focus:bg-white/10" : "bg-white/60 border-white/60 focus:bg-white"}`} 
                        placeholder="9593457XXX" 
                      />
                      <Button 
                        type="button" 
                        onClick={sendOtp} 
                        disabled={timer > 0 || isLoading || lockoutSec > 0} 
                        className={`h-12 rounded-2xl px-5 text-xs font-bold transition-all shadow-md ${isDarkMode ? "bg-white text-black hover:bg-slate-200" : "bg-black text-white hover:bg-slate-900"}`}
                      >
                        {timer > 0 ? `Resend (${timer}s)` : "Send OTP"}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 ml-1">Your 10-digit WhatsApp number — the OTP comes on WhatsApp</p>
                  </div>

                  {otpSent && (
                    <div className="space-y-2 animate-in zoom-in-95 duration-200 pt-2">
                      <div className="flex items-center justify-between ml-2 mr-1">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Verification Code</Label>
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
                                className={`w-11 sm:w-12 h-14 text-center text-xl font-black rounded-2xl border transition-all ${
                                  isDarkMode
                                    ? "bg-white/5 border-white/10 text-white focus:border-white/30 focus:bg-white/10"
                                    : "bg-white/60 border-white/60 text-slate-900 focus:border-black/30 focus:bg-white shadow-sm"
                                }`}
                              />
                            ))}
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <OtpHelp
                        sentAt={otpSentAt}
                        isDarkMode={isDarkMode}
                        onGoogle={handleGoogleLogin}
                        onEmail={() => { setLoginMethod("email"); setOtp(""); setOtpSent(false); setOtpSentAt(0); }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Risk-based Smart CAPTCHA Challenge */}
              <SmartCaptcha
                required={requiresCaptcha && lockoutSec === 0}
                onVerify={(token) => setCaptchaToken(token)}
                onReset={() => setCaptchaToken(null)}
                isDarkMode={isDarkMode}
              />

              <div className="flex items-center justify-between px-2 pt-1">
                <div className="flex items-center gap-2">
                  <Checkbox id="rem" checked={remember} onCheckedChange={(c) => setRemember(Boolean(c))} />
                  <label htmlFor="rem" className={`text-xs font-semibold cursor-pointer ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                    Remember me
                  </label>
                </div>
                {loginMethod === "email" && (
                  <Link to="/forgot" className={`text-xs font-bold hover:underline ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                    Forgot Password?
                  </Link>
                )}
              </div>

              <p id="login-error" aria-live="polite" className="min-h-[1.25rem] px-1 text-[13px] font-semibold text-[#B42318]">
                {formError}
              </p>

              <Button
                type="submit"
                disabled={isLoading || lockoutSec > 0 || (requiresCaptcha && !captchaToken)} 
                className={`w-full h-12 rounded-xl font-bold text-base bg-[#111111] text-white hover:bg-[#222222] ${lockoutSec > 0 || (requiresCaptcha && !captchaToken) ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {isLoading 
                  ? "Verifying..." 
                  : lockoutSec > 0 
                  ? `Locked (${RiskEngine.formatTime(lockoutSec)})` 
                  : requiresCaptcha && !captchaToken 
                  ? "Complete the check to sign in"
                  : "Sign In"}
              </Button>

              <p className={`text-center text-sm font-medium transition-colors pt-2 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                Don&apos;t have an account?{" "}
                <Link to="/signup" className={`font-bold hover:underline ${isDarkMode ? "text-white" : "text-black"}`}>
                  Sign up
                </Link>
              </p>
            </form>

            {/* Mobile OTP for accounts created with a phone number (paused: PHONE_OTP_ENABLED) */}
            {PHONE_OTP_ENABLED && (
            <p className="text-center text-xs text-slate-500">
              {loginMethod === "email" ? (
                <>
                  Signed up with a mobile number?{" "}
                  <button type="button" onClick={() => { setLoginMethod("phone"); setOtp(""); }} className="font-bold underline">
                    Sign in with OTP
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => { setLoginMethod("email"); setOtp(""); setOtpSent(false); }} className="font-bold underline">
                  Use email instead
                </button>
              )}
            </p>
            )}
          </div>
        </div>

        {/* Right side illustration */}
        <div className="hidden lg:flex items-center justify-center p-10 h-[560px] rounded-[28px] bg-[#7CC6FE]">
          <AuthCharacters shakeSignal={shakeSignal} />
        </div>
      </main>
    </div>
  );
}
