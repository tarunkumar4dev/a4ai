// src/lib/localDate.ts — dates for Postgres `date` columns.
// The DB's DateStyle is "ISO, MDY": "25/10/2026" (en-GB) is rejected from the 13th of a month on, so `date`
// columns get YYYY-MM-DD in the teacher's local calendar.

export function isoDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
