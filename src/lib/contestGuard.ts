// src/lib/contestGuard.ts — "a student is in a contest attempt right now".
// While set, nothing may reload the page (chunk-error reload in chunkReload.ts, any future update prompt):
// a reload mid-attempt costs the student their place and re-prompts the camera.

const KEY = "a4_contest_active";

declare global {
  interface Window { __A4_CONTEST_ACTIVE?: boolean }
}

export function setContestActive(active: boolean): void {
  window.__A4_CONTEST_ACTIVE = active;
  try {
    if (active) sessionStorage.setItem(KEY, "1");
    else sessionStorage.removeItem(KEY);
  } catch { /* storage unavailable */ }
}

export function isContestActive(): boolean {
  if (window.__A4_CONTEST_ACTIVE) return true;
  try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; }
}
