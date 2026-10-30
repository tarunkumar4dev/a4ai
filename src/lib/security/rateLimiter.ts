// src/lib/security/rateLimiter.ts
// ─────────────────────────────────────────────────────────────────────────────
// Client-side sliding-window rate limiter & OTP Cost Control Engine
// Protects sensitive endpoints (Login, Signup, OTP, API) from abuse,
// credential stuffing, and high SMS billing costs.
// ─────────────────────────────────────────────────────────────────────────────

interface RateLimitRecord {
  timestamps: number[];
  dayCount: number;
  dayResetTime: number;
}

const STORAGE_PREFIX = "a4ai_rl_";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** WhatsApp OTP: max sends per number in a rolling 24 h, and the wait before "Resend" (keep in sync with 27_otp_limit_5_per_day.sql). */
export const OTP_MAX_PER_DAY = 5;
export const OTP_RESEND_AFTER_SEC = 20;

/** Simple string hash to avoid storing plain phone/email keys in localStorage */
function hashKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

function getStoredRecord(key: string): RateLimitRecord {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${hashKey(key)}`);
    if (!raw) {
      return { timestamps: [], dayCount: 0, dayResetTime: Date.now() + 24 * 60 * 60 * 1000 };
    }
    const data: RateLimitRecord = JSON.parse(raw);
    const now = Date.now();
    // Reset daily counter if day window expired
    if (now > data.dayResetTime) {
      data.dayCount = 0;
      data.dayResetTime = now + 24 * 60 * 60 * 1000;
    }
    return data;
  } catch {
    return { timestamps: [], dayCount: 0, dayResetTime: Date.now() + 24 * 60 * 60 * 1000 };
  }
}

function saveStoredRecord(key: string, record: RateLimitRecord): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${hashKey(key)}`, JSON.stringify(record));
  } catch {
    // Graceful fallback if localStorage is disabled or full
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  resetTimeMs: number;
}

export class RateLimiter {
  /**
   * Generic sliding-window rate limiter
   * @param actionIdentifier e.g. "login:user@example.com" or "signup_global"
   * @param maxRequests maximum requests allowed in window
   * @param windowMs window in milliseconds (e.g. 5 * 60 * 1000 for 5 mins)
   */
  static checkRateLimit(
    actionIdentifier: string,
    maxRequests: number,
    windowMs: number
  ): RateLimitResult {
    const now = Date.now();
    const record = getStoredRecord(actionIdentifier);

    // Filter out timestamps outside the sliding window
    const recent = record.timestamps.filter((t) => now - t < windowMs);
    const remaining = Math.max(0, maxRequests - recent.length);

    if (recent.length >= maxRequests) {
      const oldest = recent[0];
      const retryAfterMs = oldest + windowMs - now;
      const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec,
        resetTimeMs: oldest + windowMs,
      };
    }

    return {
      allowed: true,
      remaining,
      retryAfterSec: 0,
      resetTimeMs: now + windowMs,
    };
  }

  /**
   * Records an attempt for the given identifier
   */
  static recordAttempt(actionIdentifier: string, windowMs: number): void {
    const now = Date.now();
    const record = getStoredRecord(actionIdentifier);
    const recent = record.timestamps.filter((t) => now - t < windowMs);
    recent.push(now);
    record.timestamps = recent;
    record.dayCount = (record.dayCount || 0) + 1;
    saveStoredRecord(actionIdentifier, record);
  }

  /**
   * Clears attempts upon successful login/action
   */
  static resetAttempts(actionIdentifier: string): void {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${hashKey(actionIdentifier)}`);
    } catch {
      // non-fatal
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // OTP COST CONTROL & THROTTLING (WhatsApp OTP abuse prevention)
  // Rules (mirror of a4_otp_rate_check in the DB — the server is the real limit):
  // 1. Min OTP_RESEND_AFTER_SEC between consecutive OTP requests for the same number
  // 2. Max OTP_MAX_PER_DAY requests per rolling 24 hours per number
  // ───────────────────────────────────────────────────────────────────────────

  /** Sends for this number in the last 24 h (oldest first). */
  private static otpSendsToday(phone: string): number[] {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) return [];
    const now = Date.now();
    return getStoredRecord(`otp_${cleanPhone}`).timestamps.filter((t) => now - t < ONE_DAY_MS);
  }

  static checkOtpLimit(phone: string): {
    allowed: boolean;
    reason?: string;
    retryAfterSec: number;
    remainingToday: number;
  } {
    if (!phone.replace(/\D/g, "")) {
      return { allowed: false, reason: "Invalid phone number", retryAfterSec: 0, remainingToday: 0 };
    }

    const sends = RateLimiter.otpSendsToday(phone);
    const now = Date.now();
    const remainingToday = Math.max(0, OTP_MAX_PER_DAY - sends.length);

    // 1. Rolling 24 h quota
    if (sends.length >= OTP_MAX_PER_DAY) {
      return {
        allowed: false,
        reason: `You can get at most ${OTP_MAX_PER_DAY} OTPs in 24 hours on this number. Try again later or sign in with Google or Email.`,
        retryAfterSec: Math.ceil((sends[0] + ONE_DAY_MS - now) / 1000),
        remainingToday: 0,
      };
    }

    // 2. Cooldown between sends
    const cooldown = RateLimiter.getOtpCooldownSeconds(phone);
    if (cooldown > 0) {
      return {
        allowed: false,
        reason: `Please wait ${cooldown} second(s) before requesting a new code.`,
        retryAfterSec: cooldown,
        remainingToday,
      };
    }

    return { allowed: true, retryAfterSec: 0, remainingToday };
  }

  /** OTPs this number can still get in the current 24 h window. */
  static getOtpRemainingToday(phone: string): number {
    return Math.max(0, OTP_MAX_PER_DAY - RateLimiter.otpSendsToday(phone).length);
  }

  /**
   * Records an OTP send event and updates cooldowns
   */
  static recordOtpSent(phone: string): void {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) return;
    const key = `otp_${cleanPhone}`;
    const record = getStoredRecord(key);
    const now = Date.now();
    record.timestamps = [...record.timestamps.filter((t) => now - t < ONE_DAY_MS), now];
    record.dayCount = record.timestamps.length;
    saveStoredRecord(key, record);
  }

  /**
   * Returns remaining cooldown in seconds (or 0 if ready)
   */
  static getOtpCooldownSeconds(phone: string): number {
    const lastSent = RateLimiter.otpSendsToday(phone).pop();
    if (!lastSent) return 0;
    const diff = Date.now() - lastSent;
    return diff < OTP_RESEND_AFTER_SEC * 1000 ? Math.ceil((OTP_RESEND_AFTER_SEC * 1000 - diff) / 1000) : 0;
  }
}

