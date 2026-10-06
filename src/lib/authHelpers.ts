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
