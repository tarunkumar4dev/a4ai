import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { authRedirectUrl, isInAppBrowser, IN_APP_BROWSER_MESSAGE, GOOGLE_ACCOUNT_HINT, rememberPassword, takeRedirectAfterLogin, normalizeIndianPhone, INVALID_PHONE_MESSAGE, OTP_SENT_MESSAGE, friendlyOtpError } from "@/lib/authHelpers";
import OtpBoxes, { emptyOtp } from "@/components/auth/OtpBoxes";
import { useAuth } from "@/providers/AuthProvider";
import { Eye, EyeOff, ArrowLeft, Lock, Mail } from "lucide-react";
import Navbar from "@/components/Navbar";
import AuthCharacters from "@/components/auth/AuthCharacters";
import { Helmet } from "react-helmet";
import { RateLimiter, OTP_MAX_PER_DAY, OTP_RESEND_AFTER_SEC } from "@/lib/security/rateLimiter";
import { fetchOtpQuota, formatResetIn, type OtpQuota } from "@/lib/otpQuota";
import { RiskEngine } from "@/lib/security/riskEngine";
import { WAF } from "@/lib/security/waf";
import { SmartCaptcha } from "@/components/security/SmartCaptcha";

// Format 10-digit Indian number to +91XXXXXXXXXX (shared normaliser; sendOtp validates first)
const formatPhoneForIndia = (phone: string): string => normalizeIndianPhone(phone) || phone.trim();

/** WhatsApp brand icon (official simple-icons path, brand colour #25D366). */
const WhatsAppIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const METHOD_BTN =
  "h-16 sm:h-12 flex-col sm:flex-row rounded-xl font-bold gap-1 sm:gap-2 px-2 text-[13px] bg-white text-[#1B1B1B] min-w-0";

export default function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, role } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email"); // Google + email first; mobile OTP only for older phone accounts
  const [formValues, setFormValues] = useState({ email: "", password: "", phone: "" });
  const [otp, setOtp] = useState<string[]>(emptyOtp);
  const [otpSent, setOtpSent] = useState(false);
  const [timer, setTimer] = useState(0); // seconds until "Resend" is allowed
  const [quota, setQuota] = useState<OtpQuota | null>(null); // OTPs left for this number (from the DB)
  const autoSubmittedFor = useRef(""); // the code we already auto-verified (no double submit)
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

  // Phones start on WhatsApp. Once only — a resize listener flipped Email back to WhatsApp
  // whenever the Android keyboard opened (that's a resize).
  useEffect(() => {
    const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (mobileUA || window.innerWidth < 768) setLoginMethod("phone");
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

  const phoneDigits = formValues.phone.replace(/\D/g, "");

  /** Re-read "N left today" from the DB (otp_send_log). Stale answers are dropped. */
  const quotaFor = useRef("");
  const refreshQuota = React.useCallback(async (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    quotaFor.current = digits;
    const q = await fetchOtpQuota(digits);
    if (quotaFor.current === digits) setQuota(q);
  }, []);

  useEffect(() => {
    if (loginMethod !== "phone" || phoneDigits.length !== 10) {
      setQuota(null);
      quotaFor.current = "";
      return;
    }
    const t = setTimeout(() => { void refreshQuota(phoneDigits); }, 350); // not on every keystroke
    return () => clearTimeout(t);
  }, [loginMethod, phoneDigits, refreshQuota]);

  const resetOtp = () => {
    setOtp(emptyOtp());
    setOtpSent(false);
    setTimer(0);
    autoSubmittedFor.current = "";
  };

  const switchMethod = (method: "email" | "phone") => {
    if (method === loginMethod) return;
    setLoginMethod(method);
    resetOtp();
    setFormError("");
  };

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
        title: otpCheck.remainingToday === 0 ? "OTP limit reached" : "Please wait before asking for another OTP",
        description: otpCheck.reason || "Please wait before requesting another OTP.",
        variant: "destructive",
      });
      if (otpCheck.retryAfterSec > 0 && otpCheck.retryAfterSec <= 60) setTimer(otpCheck.retryAfterSec);
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
        // Login only — an unknown number must not silently become a new (role-less) account.
        // Supabase answers "Signups not allowed for otp" → friendlyOtpError says "Sign up first".
        options: { shouldCreateUser: false },
      });
      if (error) throw error;

      // Record successful OTP dispatch in rate limiter
      RateLimiter.recordOtpSent(phoneRaw);
      void refreshQuota(phoneRaw); // the DB now has one more row for this number
      setOtp(emptyOtp()); // a resend invalidates the previous code
      autoSubmittedFor.current = "";
      setOtpSent(true);
      setTimer(OTP_RESEND_AFTER_SEC);
      setFormError("");
      toast({ title: "OTP sent", description: OTP_SENT_MESSAGE });
    } catch (error: unknown) {
      const err = error as Error;
      RiskEngine.recordFailure(phoneRaw);
      void refreshQuota(phoneRaw);
      // Server cooldown ("…after 45 seconds") → show it on the Resend countdown.
      const wait = Number(err.message?.match(/(\d+) seconds?\b/i)?.[1]);
      if (wait > 0 && wait <= 600) setTimer(wait);
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

  // The DB is the truth (survives a cleared browser / another device); the local count is the fallback.
  const otpLeft = quota ? quota.left : RateLimiter.getOtpRemainingToday(formValues.phone);
  const otpLeftLabel = `${otpLeft} of ${quota?.max ?? OTP_MAX_PER_DAY} left today`;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitLogin();
  };

  /** `codeOverride` is used by the auto-submit on the 6th OTP digit (setOtp hasn't applied yet). */
  const submitLogin = async (codeOverride?: string) => {
    // Phone mode, no OTP yet: Enter / main button sends the code instead of failing the verify.
    if (loginMethod === "phone" && !otpSent) {
      await sendOtp();
      return;
    }

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
        const otpToken = codeOverride ?? otp.join("");
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
            {/* ── Sign-in methods: Google / WhatsApp / Email, same size ── */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <Button
                variant="outline"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className={`${METHOD_BTN} border-[#E5E7EB] hover:bg-[#F7F8FA]`}
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google
              </Button>
              <Button
                variant="outline"
                onClick={() => switchMethod("phone")}
                disabled={isLoading}
                aria-pressed={loginMethod === "phone"}
                className={`${METHOD_BTN} ${loginMethod === "phone" ? "border-[#25D366] bg-[#F0FFF4] ring-1 ring-[#25D366]" : "border-[#E5E7EB] hover:bg-[#F0FFF4]"}`}
              >
                <WhatsAppIcon className="w-5 h-5 shrink-0 text-[#25D366]" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={() => switchMethod("email")}
                disabled={isLoading}
                aria-pressed={loginMethod === "email"}
                className={`${METHOD_BTN} ${loginMethod === "email" ? "border-[#111111] bg-[#F7F8FA] ring-1 ring-[#111111]" : "border-[#E5E7EB] hover:bg-[#F7F8FA]"}`}
              >
                <Mail className="w-5 h-5 shrink-0 text-[#374151]" />
                Email
              </Button>
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
                /* ── WhatsApp OTP Form (one send button: the big one below) ── */
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-1">
                    <Label htmlFor="login-phone" className="text-[12px] font-semibold text-[#374151] ml-1">WhatsApp Number</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500 select-none pointer-events-none">+91</span>
                      <Input
                        id="login-phone"
                        type="tel"
                        name="phone"
                        inputMode="numeric"
                        autoComplete="tel"
                        maxLength={10}
                        value={formValues.phone}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                          if (otpSent && digits !== formValues.phone) resetOtp(); // new number → the old code is useless
                          setFormValues((s) => ({ ...s, phone: digits }));
                          if (formError) setFormError("");
                        }}
                        className="h-12 rounded-xl pl-11 bg-white border-[#E5E7EB] text-[#1B1B1B] focus-visible:ring-[#25D366] text-base"
                        placeholder="98765 43210"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 ml-1 flex items-center gap-1">
                      <WhatsAppIcon className="w-3 h-3 text-[#25D366]" />
                      {otpSent
                        ? "OTP sent on WhatsApp. Edit the number to send to another one."
                        : quota && quota.used > 0
                        ? `OTP will be sent on WhatsApp · ${otpLeftLabel}`
                        : "OTP will be sent on WhatsApp"}
                    </p>
                  </div>

                  {otpSent && (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between ml-1 mr-1">
                        <Label className="text-[12px] font-semibold text-[#374151]">Enter the 6-digit OTP</Label>
                        {otp.some(Boolean) && (
                          <button
                            type="button"
                            onClick={() => { setOtp(emptyOtp()); autoSubmittedFor.current = ""; }}
                            className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <OtpBoxes
                        value={otp}
                        autoFocus
                        invalid={Boolean(formError)}
                        disabled={isLoading}
                        onChange={(next) => {
                          setOtp(next);
                          if (formError) setFormError("");
                          const code = next.join("");
                          if (code.length === 6 && autoSubmittedFor.current !== code) {
                            autoSubmittedFor.current = code;
                            submitLogin(code);
                          }
                        }}
                      />
                      <div className="text-center text-[13px] text-slate-600 min-h-[1.5rem]" aria-live="polite">
                        {otpLeft === 0 ? (
                          <span>
                            All {quota?.max ?? OTP_MAX_PER_DAY} OTPs for this number are used.{" "}
                            {quota?.resetInSec ? `Try again in ${formatResetIn(quota.resetInSec)}, ` : "Try again later, "}
                            or sign in with Google or Email.
                          </span>
                        ) : (
                          <>
                            {timer > 0 ? (
                              <span>
                                Resend OTP in{" "}
                                <span className="font-bold tabular-nums text-[#111111]">
                                  {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}
                                </span>
                              </span>
                            ) : (
                              <span>
                                Didn&apos;t receive the OTP?{" "}
                                <button
                                  type="button"
                                  onClick={sendOtp}
                                  disabled={isLoading || lockoutSec > 0}
                                  className="font-bold text-[#128C4A] underline underline-offset-2 hover:text-[#0B6B37] disabled:opacity-50"
                                >
                                  Resend OTP
                                </button>
                              </span>
                            )}
                            <span className="block text-[12px] text-slate-400 mt-0.5">{otpLeftLabel}</span>
                          </>
                        )}
                      </div>
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
                className={`w-full h-12 rounded-xl font-bold text-base ${
                  loginMethod === "phone" && !otpSent
                    ? "bg-[#25D366] text-white hover:bg-[#1DA851]"
                    : "bg-[#111111] text-white hover:bg-[#222222]"
                } ${lockoutSec > 0 || (requiresCaptcha && !captchaToken) ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {isLoading
                  ? loginMethod === "phone" && !otpSent ? "Sending..." : "Verifying..."
                  : lockoutSec > 0
                  ? `Locked (${RiskEngine.formatTime(lockoutSec)})`
                  : requiresCaptcha && !captchaToken
                  ? "Complete the check to sign in"
                  : loginMethod === "phone" && !otpSent
                  ? "Send OTP on WhatsApp"
                  : loginMethod === "phone" && otpSent
                  ? "Verify OTP"
                  : "Sign In"}
              </Button>

              <p className={`text-center text-sm font-medium transition-colors pt-2 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                Don&apos;t have an account?{" "}
                <Link to="/signup" className={`font-bold hover:underline ${isDarkMode ? "text-white" : "text-black"}`}>
                  Sign up
                </Link>
              </p>
            </form>

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
