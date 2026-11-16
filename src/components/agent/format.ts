// Small display helpers shared by the agent blocks. null / undefined / "" always render "—", never 0.
export const dash = (v: string | number | null | undefined): string =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (typeof v === "number" && !Number.isFinite(v)) ? "—" : String(v);

const IST: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata" };

/** "5 Nov, 1:13 pm IST" (falls back to the raw string when it isn't a date). */
export function asOfLabel(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return iso || "—";
  return `${d.toLocaleString("en-IN", { ...IST, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} IST`;
}

/** "tool:low_attendance_list" → "Low attendance list" */
export function sourceLabel(source: string): string {
  const s = source.replace(/^tool:/, "").replace(/_/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "a4ai";
}

/** Message timestamp for title/tooltip: "6 Nov 2026, 4:05 pm" */
export function timeLabel(ms: number | undefined): string {
  if (!ms) return "";
  return new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Sidebar list: "4:05 pm" today, "Kal", "3 Nov" */
export function shortWhen(ms: number, now = Date.now()): string {
  if (!ms) return "";
  const d = new Date(ms), n = new Date(now);
  if (d.toDateString() === n.toDateString()) return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const y = new Date(now - 86_400_000);
  if (d.toDateString() === y.toDateString()) return "Kal";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** 90 → "1 hr 30 min" */
export function durationLabel(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "—";
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr${h > 1 ? "s" : ""}`;
}

/** 40 → "40", 2.5 → "2.5" */
export const num = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
