// src/components/auth/OtpBoxes.tsx
// 6 separate digit boxes (real <input>s, not input-otp): tap any box to fix that digit,
// Backspace/arrows move between boxes, paste or SMS/WhatsApp autofill of the whole code fills all 6.
import React, { useEffect, useRef } from "react";

export const OTP_LENGTH = 6;
export const emptyOtp = (): string[] => Array(OTP_LENGTH).fill("");

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
}

export default function OtpBoxes({ value, onChange, disabled, autoFocus, invalid }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const focusBox = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(OTP_LENGTH - 1, i))];
    el?.focus();
    el?.select();
  };

  /** Write `digits` starting at box `start`; focus the box after the last one written. */
  const fill = (start: number, digits: string) => {
    const next = [...value];
    let i = start;
    for (const d of digits) {
      if (i >= OTP_LENGTH) break;
      next[i++] = d;
    }
    onChange(next);
    focusBox(i);
  };

  const handleChange = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      const next = [...value];
      next[i] = "";
      onChange(next);
      return;
    }
    if (digits.length === 1) return fill(i, digits);
    // Typed into a box that already had a digit (caret not selected) → keep the new one.
    if (digits.length === 2 && value[i]) return fill(i, digits[0] === value[i] ? digits[1] : digits[0]);
    // Autofill / paste of the whole code lands in one box.
    fill(digits.length >= OTP_LENGTH ? 0 : i, digits.slice(0, OTP_LENGTH));
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      e.preventDefault();
      const next = [...value];
      next[i - 1] = "";
      onChange(next);
      focusBox(i - 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusBox(i + 1);
    }
  };

  const handlePaste = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!digits) return;
    e.preventDefault();
    fill(digits.length >= OTP_LENGTH ? 0 : i, digits.slice(0, OTP_LENGTH));
  };

  return (
    <div className="grid grid-cols-6 gap-2 w-full" role="group" aria-label="6-digit OTP">
      {value.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.target.select()}
          className={`h-14 w-full min-w-0 rounded-xl border-2 bg-white text-center text-2xl font-bold text-[#111111] outline-none focus:border-[#25D366] focus:ring-4 focus:ring-[#25D366]/20 disabled:opacity-60 ${
            invalid ? "border-[#F04438]" : d ? "border-[#9CA3AF]" : "border-[#D1D5DB]"
          }`}
        />
      ))}
    </div>
  );
}
