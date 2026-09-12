// src/lib/security/waf.ts
// ─────────────────────────────────────────────────────────────────────────────
// Lightweight Client/Edge WAF (Web Application Firewall) & Request Sanitizer
// Detects common malicious patterns (SQLi, XSS, Path Traversal) and sanitizes
// incoming payloads before dispatching to Supabase or backend APIs.
// ─────────────────────────────────────────────────────────────────────────────

// Dangerous patterns for SQLi, XSS, and command injection
const SQLI_PATTERNS = [
  /(\b(UNION(\s+ALL)?|SELECT|INSERT|DELETE|UPDATE|DROP|ALTER|EXEC|EXECUTE)\b.*(\bFROM\b|\bTABLE\b|\bINTO\b))/i,
  /('|"|;)\s*(--|\/\*|\#)/i,
  /'\s*OR\s*('?[0-9a-z]+'?)\s*=\s*('?[0-9a-z]+'?)/i,
  /WAITFOR\s+DELAY\s+/i,
  /BENCHMARK\s*\(/i,
  /PG_SLEEP\s*\(/i,
];

const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript\s*:/gi,
  /data\s*:\s*text\/html/gi,
  /on(error|load|click|mouse|hover|focus|blur|change|submit)\s*=/gi,
  /<iframe|<object|<embed|<base\b/gi,
];

export interface WAFInspectionResult {
  isSafe: boolean;
  threatType?: "SQLI" | "XSS" | "HONEYPOT" | "MALFORMED";
  threatDetails?: string;
  sanitizedValue?: string;
}

export class WAF {
  /**
   * Sanitizes generic string inputs while preserving international characters,
   * punctuation in passwords, and valid email/phone formats.
   */
  static sanitizeString(input: string): string {
    if (typeof input !== "string") return "";
    return input
      .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, "") // Remove ASCII control characters
      .trim();
  }

  /**
   * Inspects a single input value for malicious injection signatures.
   */
  static inspectValue(fieldName: string, value: any): WAFInspectionResult {
    if (typeof value !== "string") return { isSafe: true };

    // 1. SQL Injection Check
    for (const pattern of SQLI_PATTERNS) {
      if (pattern.test(value)) {
        return {
          isSafe: false,
          threatType: "SQLI",
          threatDetails: `Suspicious query pattern detected in field "${fieldName}"`,
        };
      }
    }

    // 2. XSS Check (passwords are allowed special characters, but form names/emails shouldn't contain script tags)
    if (fieldName !== "password" && fieldName !== "confirmPassword") {
      for (const pattern of XSS_PATTERNS) {
        if (pattern.test(value)) {
          return {
            isSafe: false,
            threatType: "XSS",
            threatDetails: `Unsafe script or markup detected in field "${fieldName}"`,
          };
        }
      }
    }

    return {
      isSafe: true,
      sanitizedValue: this.sanitizeString(value),
    };
  }

  /**
   * Inspects an entire form submission or payload dictionary.
   */
  static inspectPayload(payload: Record<string, any>): WAFInspectionResult {
    for (const [key, value] of Object.entries(payload)) {
      if (key === "honeypot" || key === "website_hp") {
        if (value && String(value).trim().length > 0) {
          return {
            isSafe: false,
            threatType: "HONEYPOT",
            threatDetails: "Automated bot submission detected via honeypot field",
          };
        }
        continue;
      }

      const result = this.inspectValue(key, value);
      if (!result.isSafe) {
        return result;
      }
    }

    return { isSafe: true };
  }

  /**
   * Clean and normalize phone numbers specifically for Indian telecom standard (+91)
   */
  static sanitizeIndianPhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
    if (phone.startsWith("+")) return phone.replace(/\s+/g, "");
    return digits;
  }
}

