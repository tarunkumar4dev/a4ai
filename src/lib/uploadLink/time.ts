// src/lib/uploadLink/time.ts — server stores UTC, the UI always shows IST (display: fmtIST in src/lib/uploadFlow.ts).

/** "2 din 3 ghante", "45 min", "30 sec" — for countdowns. */
export function fmtLeft(ms: number): string {
  if (ms <= 0) return "0 sec";
  const s = Math.ceil(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} din ${h} ghante`;
  if (h > 0) return `${h} ghante ${m} min`;
  if (m > 0) return `${m} min ${s % 60} sec`;
  return `${s} sec`;
}

/** <input type="datetime-local"> value (IST wall clock) ↔ ISO UTC. */
export function isoToIstInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(new Date(iso).getTime() + 330 * 60_000);
  return t.toISOString().slice(0, 16);
}
export function istInputToIso(value: string): string | null {
  if (!value) return null;
  const [d, t] = value.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  return new Date(Date.UTC(y, mo - 1, da, h, mi) - 330 * 60_000).toISOString();
}
