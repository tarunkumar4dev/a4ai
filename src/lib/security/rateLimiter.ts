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
  // OTP COST CONTROL & THROTTLING (SMS API Abuse Prevention)
  // Rules:
  // 1. Min 60s cooldown between consecutive OTP requests for the same number
  // 2. Max 3 OTP requests per hour per number
  // 3. Max 5 OTP requests per 24 hours per number (prevents bill blowout)
  // ───────────────────────────────────────────────────────────────────────────

  static checkOtpLimit(phone: string): {
    allowed: boolean;
    reason?: string;
    retryAfterSec: number;
    remainingToday: number;
  } {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) {
      return { allowed: false, reason: "Invalid phone number", retryAfterSec: 0, remainingToday: 0 };
    }

    const key = `otp_${cleanPhone}`;
    const record = getStoredRecord(key);
    const now = Date.now();

    // 1. Daily Quota Check (Max 5 / day)
    const MAX_DAILY_OTP = 5;
    const remainingToday = Math.max(0, MAX_DAILY_OTP - record.dayCount);
    if (record.dayCount >= MAX_DAILY_OTP) {
      const retryAfterSec = Math.ceil((record.dayResetTime - now) / 1000);
      return {
        allowed: false,
        reason: "Daily OTP limit reached (5/day). Please try again tomorrow or contact support.",
        retryAfterSec,
        remainingToday: 0,
      };
    }

    // 2. Hourly Burst Check (Max 3 / hr)
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const pastHourTimestamps = record.timestamps.filter((t) => now - t < ONE_HOUR_MS);
    if (pastHourTimestamps.length >= 3) {
      const oldestInHour = pastHourTimestamps[0];
      const retryAfterSec = Math.ceil((oldestInHour + ONE_HOUR_MS - now) / 1000);
      return {
        allowed: false,
        reason: `Too many OTP requests. Please wait ${Math.ceil(retryAfterSec / 60)} minute(s) before requesting another OTP.`,
        retryAfterSec,
        remainingToday,
      };
    }

    // 3. 60-Second Cooldown Check
    const COOLDOWN_MS = 60 * 1000;
    const lastSent = record.timestamps[record.timestamps.length - 1];
    if (lastSent && now - lastSent < COOLDOWN_MS) {
      const retryAfterSec = Math.ceil((lastSent + COOLDOWN_MS - now) / 1000);
      return {
        allowed: false,
        reason: `Please wait ${retryAfterSec} second(s) before requesting a new code.`,
        retryAfterSec,
        remainingToday,
      };
    }

    return {
      allowed: true,
      retryAfterSec: 0,
      remainingToday,
    };
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
    record.timestamps.push(now);
    record.dayCount = (record.dayCount || 0) + 1;
    saveStoredRecord(key, record);
  }

  /**
   * Returns remaining cooldown in seconds (or 0 if ready)
   */
  static getOtpCooldownSeconds(phone: string): number {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) return 0;
    const key = `otp_${cleanPhone}`;
    const record = getStoredRecord(key);
    const lastSent = record.timestamps[record.timestamps.length - 1];
    if (!lastSent) return 0;
    const diff = Date.now() - lastSent;
    return diff < 60000 ? Math.ceil((60000 - diff) / 1000) : 0;
  }
}

