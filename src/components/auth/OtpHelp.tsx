// src/components/auth/OtpHelp.tsx
// "OTP nahi aaya?" box shown OTP_HELP_AFTER_MS after a WhatsApp OTP was sent.
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
      <p className="font-bold mb-1">OTP nahi aaya?</p>
      <ul className="list-disc ml-4 space-y-0.5">
        <li>WhatsApp kholke check karein — message "a4ai" ke naam se aata hai.</li>
        <li>Kya ye number WhatsApp pe hai? Nahi to WhatsApp wala number daalein.</li>
        <li>Timer khatam hone par "Resend" dabayein.</li>
      </ul>
      {(onGoogle || onEmail) && (
        <p className="mt-2">
          Ya{" "}
          {onGoogle && (
            <button type="button" onClick={onGoogle} className={link}>
              Google se login
            </button>
          )}
          {onGoogle && onEmail && " / "}
          {onEmail && (
            <button type="button" onClick={onEmail} className={link}>
              Email se login
            </button>
          )}{" "}
          karein.
        </p>
      )}
    </div>
  );
}
