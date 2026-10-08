// src/lib/authHelpers.ts
// Small helpers shared by LoginPage / SignupPage.

/** OAuth + email-confirmation redirect. a4ai is web-only (no native app), so this is always the web callback —
 *  the old mobile value `io.supabase.a4ai://login-callback` pointed at an app that doesn't exist. */
export const authRedirectUrl = () => `${window.location.origin}/auth/callback`;

/** In-app browsers (WhatsApp, Instagram, Facebook, LinkedIn, Snapchat, Android WebView) — Google blocks OAuth there. */
export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|Instagram|WhatsApp|LinkedInApp|Snapchat|Line\/|; wv\)/i.test(ua);
}

export const IN_APP_BROWSER_MESSAGE =
  "Google login doesn't work inside the WhatsApp/Instagram browser. Tap the ⋮ menu, choose \"Open in Chrome\" (Safari on iPhone) and try again.";

/** Shown when email + password login fails: accounts created with Google have no password. */
export const GOOGLE_ACCOUNT_HINT =
  "If you created this account with Google, use \"Google Login\", or set a new password with \"Forgot Password\".";

/**
 * Ask the browser to save the login (Chrome/Edge/Android support the Credential Management API).
 * SPA logins navigate without a real form submit, so the browser often doesn't offer to save on its own.
 * Never throws — saving the password is a convenience, not part of login.
 */
export async function rememberPassword(email: string, password: string, name?: string): Promise<void> {
  try {
    const w = window as any;
    if (!w.PasswordCredential || !navigator.credentials?.store) return;
    const cred = new w.PasswordCredential({ id: email, password, name: name || email });
    await navigator.credentials.store(cred);
  } catch {
    /* unsupported browser or user dismissed — ignore */
  }
}

/* ── Phone OTP over WhatsApp (Supabase Send SMS Hook → Edge Function send-whatsapp-otp) ── */

/** Indian mobile → "+91XXXXXXXXXX", or null if it isn't a valid 10-digit Indian mobile.
 *  Accepts spaces/dashes, "+91", "91" and a leading "0". One formatter for every OTP screen
 *  (the old copies disagreed — e.g. "09310…" passed through unformatted in LoginModal). */
export function normalizeIndianPhone(raw: string): string | null {
  let d = (raw || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length !== 10 || !/^[6-9]/.test(d)) return null;
  return `+91${d}`;
}

export const INVALID_PHONE_MESSAGE = "Enter a valid 10-digit mobile number (the one on WhatsApp).";
export const OTP_SENT_MESSAGE = "We sent the OTP to your WhatsApp.";
const OTP_SERVICE_DOWN = "WhatsApp OTP is unavailable right now. Please sign in with Google or Email.";

/** Supabase / hook error → message a user can act on. Also maps the older Hinglish messages
 *  of the send-whatsapp-otp Edge Function, so the page stays English whichever version is deployed. */
export function friendlyOtpError(message: string | undefined): string {
  const m = message || "";
  const wait = m.match(/(\d+) seconds?\b/i);
  if (wait) return `You can request a new OTP in ${wait[1]} seconds.`;
  if (/expired|invalid.*(otp|token)|token.*invalid/i.test(m)) return "The OTP is wrong or has expired. Tap Resend and enter the new OTP.";
  if (/not on WhatsApp|WhatsApp nahi mila/i.test(m)) return "This number is not on WhatsApp. Use your WhatsApp number or sign in with Google or Email.";
  if (/hour|ghante/i.test(m)) return "Too many OTPs were sent to this number. Try again in an hour or sign in with Google or Email.";
  if (/today|tomorrow|aaj ki/i.test(m)) return "This number has reached today's OTP limit. Try again tomorrow or sign in with Google or Email.";
  if (/slow/i.test(m)) return "WhatsApp is responding slowly. Please try again.";
  if (/rate limit|too many|Bahut/i.test(m)) return "Too many attempts. Please try again in a minute.";
  if (/valid 10-digit|Sahi 10-digit/i.test(m)) return INVALID_PHONE_MESSAGE;
  if (/could not send|OTP bhejne/i.test(m)) return "Could not send the OTP. Please try again shortly or sign in with Google or Email.";
  if (/hook|sms|provider|send|unavailable|nahi ja pa raha/i.test(m)) return OTP_SERVICE_DOWN;
  return m || OTP_SERVICE_DOWN;
}

/** Seconds after "OTP sent" before showing the "Didn't get the OTP?" help. */
export const OTP_HELP_AFTER_MS = 30_000;

/** Phone (WhatsApp) OTP sign-in is paused until the WhatsApp sender is live; Google + email only.
 *  Set VITE_PHONE_OTP_ENABLED=true (Vercel env, then redeploy) to bring it back. */
export const PHONE_OTP_ENABLED = String(import.meta.env.VITE_PHONE_OTP_ENABLED ?? "false").toLowerCase() === "true";

/* ── Post-login redirect (LoginModal stores the page the user was on) ── */
const REDIRECT_KEY = "a4ai_redirect_after_login";

/** Read + clear the stored "go back here after login" path. Only same-site app paths are allowed. */
export function takeRedirectAfterLogin(): string | null {
  let path: string | null = null;
  try {
    path = localStorage.getItem(REDIRECT_KEY);
    localStorage.removeItem(REDIRECT_KEY);
  } catch { /* storage blocked */ }
  if (!path || !path.startsWith("/") || path.startsWith("//") || path === "/") return null;
  if (/^\/(login|signup|select-role|auth|forgot|reset-password)/.test(path)) return null;
  return path;
}

export function rememberRedirectAfterLogin(): void {
  try {
    const here = window.location.pathname + window.location.search;
    if (here && here !== "/") localStorage.setItem(REDIRECT_KEY, here);
    else localStorage.removeItem(REDIRECT_KEY);
  } catch { /* storage blocked */ }
}
