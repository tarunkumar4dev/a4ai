// src/lib/security/riskEngine.ts
// ─────────────────────────────────────────────────────────────────────────────
// Risk Detection & Account Lockout Engine
// Detects brute force attempts, credential stuffing, bot behaviors,
// and enforces progressive account cooldowns.
// ─────────────────────────────────────────────────────────────────────────────

interface LockoutState {
  failedAttempts: number;
  lockedUntil: number | null;
  lastFailedTime: number | null;
}

const STORAGE_PREFIX = "a4ai_risk_";
const RISK_CAPTCHA_THRESHOLD = 30;
const RISK_LOCKOUT_ATTEMPTS = 5;

function hashKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function getLockoutState(identifier: string): LockoutState {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${hashKey(identifier)}`);
    if (!raw) return { failedAttempts: 0, lockedUntil: null, lastFailedTime: null };
    const parsed: LockoutState = JSON.parse(raw);
    // Auto-reset if 30 minutes have elapsed since last failure
    if (parsed.lastFailedTime && Date.now() - parsed.lastFailedTime > 30 * 60 * 1000) {
      return { failedAttempts: 0, lockedUntil: null, lastFailedTime: null };
    }
    return parsed;
  } catch {
    return { failedAttempts: 0, lockedUntil: null, lastFailedTime: null };
  }
}

function saveLockoutState(identifier: string, state: LockoutState): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${hashKey(identifier)}`, JSON.stringify(state));
  } catch {
    // non-fatal
  }
}

export interface RiskFactors {
  identifier: string;
  formMountTimestamp: number;
  honeypotValue?: string;
}

export interface RiskEvaluation {
  riskScore: number;
  requiresCaptcha: boolean;
  isLocked: boolean;
  lockoutRemainingSec: number;
  failedCount: number;
  reason?: string;
}

export class RiskEngine {
  /**
   * Checks current lockout status for an identifier (email or phone)
   */
  static getLockoutStatus(identifier: string): { isLocked: boolean; remainingSec: number; failedAttempts: number } {
    if (!identifier) return { isLocked: false, remainingSec: 0, failedAttempts: 0 };
    const state = getLockoutState(identifier);
    const now = Date.now();

    if (state.lockedUntil && state.lockedUntil > now) {
      const remainingSec = Math.ceil((state.lockedUntil - now) / 1000);
      return { isLocked: true, remainingSec, failedAttempts: state.failedAttempts };
    }

    return { isLocked: false, remainingSec: 0, failedAttempts: state.failedAttempts };
  }

  /**
   * Evaluates risk before or during an auth attempt
   */
  static evaluateRisk(factors: RiskFactors): RiskEvaluation {
    const { identifier, formMountTimestamp, honeypotValue } = factors;
    let riskScore = 0;
    const reasons: string[] = [];

    // 1. Honeypot check: If the hidden honeypot field is filled, it's definitely a bot
    if (honeypotValue && honeypotValue.trim().length > 0) {
      riskScore += 100;
      reasons.push("Bot signature detected (honeypot triggered)");
    }

    // 2. Submission speed check: Submissions under 800ms from form load indicate automation
    const elapsedMs = Date.now() - formMountTimestamp;
    if (elapsedMs < 800) {
      riskScore += 50;
      reasons.push("Suspiciously fast submission");
    }

    // 3. Headless / automation environment detection
    if (typeof navigator !== "undefined") {
      if ((navigator as any).webdriver) {
        riskScore += 60;
        reasons.push("Automated browser detected");
      }
    }

    // 4. Failed attempts weight
    const lockout = this.getLockoutStatus(identifier);
    riskScore += lockout.failedAttempts * 20;

    const requiresCaptcha = riskScore >= RISK_CAPTCHA_THRESHOLD || lockout.failedAttempts >= 2;

    return {
      riskScore: Math.min(100, riskScore),
      requiresCaptcha,
      isLocked: lockout.isLocked,
      lockoutRemainingSec: lockout.remainingSec,
      failedCount: lockout.failedAttempts,
      reason: reasons.join(", "),
    };
  }

  /**
   * Records a failed login attempt and calculates lockout cooldown
   */
  static recordFailure(identifier: string): RiskEvaluation {
    if (!identifier) {
      return { riskScore: 20, requiresCaptcha: false, isLocked: false, lockoutRemainingSec: 0, failedCount: 1 };
    }

    const state = getLockoutState(identifier);
    state.failedAttempts += 1;
    state.lastFailedTime = Date.now();

    // Lockout rules:
    // 5 attempts -> 5 mins (300,000 ms)
    // 10+ attempts -> 15 mins (900,000 ms)
    if (state.failedAttempts >= 10) {
      state.lockedUntil = Date.now() + 15 * 60 * 1000;
    } else if (state.failedAttempts >= RISK_LOCKOUT_ATTEMPTS) {
      state.lockedUntil = Date.now() + 5 * 60 * 1000;
    }

    saveLockoutState(identifier, state);

    const now = Date.now();
    const remainingSec = state.lockedUntil && state.lockedUntil > now
      ? Math.ceil((state.lockedUntil - now) / 1000)
      : 0;

    const riskScore = Math.min(100, state.failedAttempts * 20);

    return {
      riskScore,
      requiresCaptcha: riskScore >= RISK_CAPTCHA_THRESHOLD || state.failedAttempts >= 2,
      isLocked: remainingSec > 0,
      lockoutRemainingSec: remainingSec,
      failedCount: state.failedAttempts,
      reason: remainingSec > 0 ? "Too many failed attempts. Temporary lockout enforced." : undefined,
    };
  }

  /**
   * Resets failed attempts upon successful login
   */
  static recordSuccess(identifier: string): void {
    if (!identifier) return;
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${hashKey(identifier)}`);
    } catch {
      // non-fatal
    }
  }

  /**
   * Helper to format remaining seconds as mm:ss
   */
  static formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }
}

