// src/lib/studentName.ts — the name a student appears with on a contest leaderboard.
// Profile full_name when it is a real name; otherwise the lobby asks once and this device remembers it.

const KEY = "a4_contest_name";
const PLACEHOLDERS = new Set(["user", "student", "teacher", "guest", "test", "name"]);

/** Collapse spaces and trim. */
export const cleanName = (n: string | null | undefined) => (n || "").replace(/\s+/g, " ").trim();

/** 2–40 characters after cleaning. */
export const isValidName = (n: string | null | undefined) => {
  const c = cleanName(n);
  return c.length >= 2 && c.length <= 40;
};

/** A profile name worth showing (not empty / "User" placeholder / an email). */
export const isRealName = (n: string | null | undefined) => {
  const c = cleanName(n);
  return isValidName(c) && !PLACEHOLDERS.has(c.toLowerCase()) && !c.includes("@");
};

export function loadSavedName(): string {
  try { return localStorage.getItem(KEY) || ""; } catch { return ""; }
}

export function saveName(n: string): void {
  try { localStorage.setItem(KEY, cleanName(n)); } catch { /* private mode */ }
}
