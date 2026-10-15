// src/lib/auth.ts
// One place for the things every page needs from the staff session:
//   signOut()     — local sign-out that always clears this browser, even offline
//   signOutEverywhere() / signOutOtherDevices() — global sign-out / after a password change
//   authFetch()   — fetch to FastAPI with the current access token; on 401 refreshes once and retries,
//                   and signs out cleanly if the backend still says 401
// The session itself lives in "@/lib/supabaseClient" (the only persisting client); supabase-js refreshes
// the access token in the background and serialises refreshes across tabs with a navigator lock.
import { supabase, AUTH_STORAGE_KEY } from "@/lib/supabaseClient";

/**
 * Signs out this browser only (other devices stay signed in).
 * supabase-js keeps the session in storage when the sign-out request fails (e.g. offline), which on a
 * shared office computer would leave the next person signed in — so we wipe it ourselves in that case.
 */
export async function signOut(): Promise<void> {
  let failed = false;
  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    failed = !!error;
  } catch {
    failed = true;
  }
  if (failed) {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`);
    } catch {
      /* storage unavailable */
    }
    // the client still holds the session in memory; a full reload drops it
    window.location.assign("/login");
  }
}

/**
 * "Log out from all devices": revokes every refresh token of this user, then clears this browser.
 * Other devices drop out at their next backend call (≤30 s token cache) or token refresh (≤1 h).
 * Throws when the server can't be reached — the other devices would still be signed in, so the
 * caller must tell the user instead of pretending it worked.
 */
export async function signOutEverywhere(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) throw error;
}

/** Revokes every session except this one (used after a password change). */
export async function signOutOtherDevices(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) throw error;
}

/** Current access token (supabase-js refreshes it first if it has expired), or null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * A token newer than `sent`, or null if there is none.
 * Another request may already have refreshed — then reuse that token instead of refreshing again.
 */
async function freshTokenAfter401(sent: string): Promise<string | null> {
  const current = await getAccessToken();
  if (current && current !== sent) return current;
  const { data, error } = await supabase.auth.refreshSession();
  // An invalid/revoked refresh token makes supabase-js drop the session itself (SIGNED_OUT);
  // a network error keeps it, so the user is not logged out just for being offline.
  if (error) return null;
  return data.session?.access_token ?? null;
}

function withToken(init: RequestInit, token: string | null): RequestInit {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  else headers.delete("Authorization");
  return { ...init, headers };
}

/**
 * fetch() for the FastAPI backend. Sends the current access token; on a 401 refreshes the session
 * once and retries once. If the retry is still 401 the session is dead server-side (e.g. revoked by
 * "log out from all devices") and this browser is signed out.
 * Bodies must be re-sendable (string / FormData / Blob), which every caller uses.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(input, withToken(init, token));
  if (res.status !== 401 || !token) return res;

  let fresh: string | null;
  try {
    fresh = await freshTokenAfter401(token);
  } catch {
    return res;
  }
  if (!fresh) return res;

  const retry = await fetch(input, withToken(init, fresh));
  if (retry.status === 401) await signOut();
  return retry;
}

