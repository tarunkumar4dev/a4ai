// src/components/auth/OtpHelp.tsx
// "Didn't get the OTP?" box shown OTP_HELP_AFTER_MS after a WhatsApp OTP was sent.
// Meta accepts the message even if the number isn't on WhatsApp (delivery fails later, silently),
// so the page can't detect it — this box is the way out for that user.
import React, { useEffect, useState } from "react";
import { OTP_HELP_AFTER_MS } from "@/lib/authHelpers";

interface Props {
  /** Changes every time an OTP is (re)sent — restarts the 30 s wait. 0 = no OTP sent. */
  sentAt: number;
  onGoogle?: () => void;
  onEmail?: () => void;
  isDarkMode?: boolean;
}

export default function OtpHelp({ sentAt, onGoogle, onEmail, isDarkMode }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(false);
    if (!sentAt) return;
    const t = setTimeout(() => setShow(true), OTP_HELP_AFTER_MS);
    return () => clearTimeout(t);
  }, [sentAt]);

  if (!show) return null;

  const link = `font-bold underline underline-offset-2 ${isDarkMode ? "text-white" : "text-slate-900"}`;
  return (
    <div
      className={`rounded-2xl p-3 text-xs leading-relaxed border ${
        isDarkMode ? "bg-white/5 border-white/10 text-slate-300" : "bg-amber-50 border-amber-200 text-amber-900"
      }`}
    >
      <p className="font-bold mb-1">Didn't get the OTP?</p>
      <ul className="list-disc ml-4 space-y-0.5">
        <li>Open WhatsApp and check — the message comes from "a4ai".</li>
        <li>Is this number on WhatsApp? If not, enter your WhatsApp number.</li>
        <li>When the timer ends, tap "Resend".</li>
      </ul>
      {(onGoogle || onEmail) && (
        <p className="mt-2">
          Or sign in with{" "}
          {onGoogle && (
            <button type="button" onClick={onGoogle} className={link}>
              Google
            </button>
          )}
          {onGoogle && onEmail && " / "}
          {onEmail && (
            <button type="button" onClick={onEmail} className={link}>
              Email
            </button>
          )}
          .
        </p>
      )}
    </div>
  );
}
