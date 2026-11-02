// src/lib/otpQuota.ts
// "N left today" for the WhatsApp OTP screens, read from the DB (otp_send_log via the a4_otp_quota RPC)
// so the count survives a cleared browser or a second device. The browser limiter is only the fallback
// (27_otp_limit_5_per_day.sql not applied yet, offline, RPC error).
import { supabase } from "@/lib/supabaseClient";
import { RateLimiter, OTP_MAX_PER_DAY, OTP_RESEND_AFTER_SEC } from "@/lib/security/rateLimiter";
import { normalizeIndianPhone } from "@/lib/authHelpers";

export interface OtpQuota {
  /** OTPs this number can still get in the current 24 h window. */
  left: number;
  max: number;
  used: number;
  /** Seconds until the next send is allowed. */
  nextInSec: number;
  /** Seconds until the oldest send falls out of the 24 h window (0 when none). */
  resetInSec: number;
  /** false = the DB count was unavailable and this is the browser's own count. */
  fromServer: boolean;
}

function localQuota(phone: string): OtpQuota {
  const left = RateLimiter.getOtpRemainingToday(phone);
  return {
    left,
    max: OTP_MAX_PER_DAY,
    used: OTP_MAX_PER_DAY - left,
    nextInSec: RateLimiter.getOtpCooldownSeconds(phone),
    resetInSec: 0,
    fromServer: false,
  };
}

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Never throws: a quota we can't read must not block signing in. */
export async function fetchOtpQuota(phone: string): Promise<OtpQuota> {
  if (!normalizeIndianPhone(phone)) return localQuota(phone);
  try {
    const { data, error } = await supabase.rpc("a4_otp_quota", { p_phone: phone });
    const row = data as Record<string, unknown> | null;
    if (error || !row || row.valid !== true) return localQuota(phone);
    const max = num(row.max, OTP_MAX_PER_DAY);
    return {
      left: Math.max(0, Math.min(max, num(row.left, max))),
      max,
      used: num(row.used),
      nextInSec: Math.max(0, Math.min(OTP_RESEND_AFTER_SEC, num(row.next_in_sec))),
      resetInSec: Math.max(0, num(row.reset_in_sec)),
      fromServer: true,
    };
  } catch {
    return localQuota(phone);
  }
}

/** "1 hour" / "23 hours" / "12 minutes" — when the number gets its OTPs back. */
export function formatResetIn(sec: number): string {
  if (sec <= 0) return "later today";
  if (sec < 3600) {
    const m = Math.max(1, Math.round(sec / 60));
    return `${m} minute${m === 1 ? "" : "s"}`;
  }
  const h = Math.round(sec / 3600);
  return `${h} hour${h === 1 ? "" : "s"}`;
}
