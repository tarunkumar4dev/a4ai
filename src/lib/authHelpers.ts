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
  "Google login WhatsApp/Instagram ke andar wale browser me nahi chalta. Upar ⋮ menu se \"Open in Chrome\" (iPhone pe Safari) karke dobara try karein.";

/** Shown when email + password login fails: accounts created with Google have no password. */
export const GOOGLE_ACCOUNT_HINT =
  "Agar ye account Google se banaya tha to \"Google Login\" dabaiye, ya \"Forgot Password\" se naya password set karein.";

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

export const INVALID_PHONE_MESSAGE = "Sahi 10-digit mobile number daalein (WhatsApp wala).";
export const OTP_SENT_MESSAGE = "OTP aapke WhatsApp pe bheja gaya hai.";
const OTP_SERVICE_DOWN = "WhatsApp OTP abhi nahi ja pa raha. Google ya Email se login karein.";

/** Supabase / hook error → message a user can act on. */
export function friendlyOtpError(message: string | undefined): string {
  const m = message || "";
  const wait = m.match(/after (\d+) seconds?/i);
  if (wait) return `Naya OTP ${wait[1]} second baad maang sakte hain.`;
  if (/expired|invalid.*(otp|token)|token.*invalid/i.test(m)) return "OTP galat hai ya expire ho gaya. Resend karke naya OTP daalein.";
  // Messages written by our Edge Function are already user-facing — show them as they are
  const ours = m.match(/(WhatsApp[^.]*\.[^"]*|Naya OTP[^"]*|Is number[^"]*|Bahut saari[^"]*|OTP bhejne[^"]*|Sahi 10-digit[^"]*)/);
  if (ours) return ours[1].trim();
  if (/rate limit|too many/i.test(m)) return "Bahut zyada koshishein. Thodi der baad try karein.";
  if (/hook|sms|provider|send/i.test(m)) return OTP_SERVICE_DOWN;
  return m || OTP_SERVICE_DOWN;
}

/** Seconds after "OTP sent" before showing the "OTP nahi aaya?" help. */
export const OTP_HELP_AFTER_MS = 30_000;
