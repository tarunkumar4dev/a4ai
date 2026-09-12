// src/components/security/SmartCaptcha.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Risk-Based Smart CAPTCHA Component
// Renders ZERO friction when risk is low (<30).
// Seamlessly activates an interactive verification challenge when risk is detected
// (e.g., repeated failed attempts, rapid submissions, suspicious patterns).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from "react";
import { ShieldCheck, ShieldAlert, RefreshCw, CheckCircle2 } from "lucide-react";

interface SmartCaptchaProps {
  required: boolean;
  onVerify: (token: string) => void;
  onReset?: () => void;
  isDarkMode?: boolean;
}

export const SmartCaptcha: React.FC<SmartCaptchaProps> = ({
  required,
  onVerify,
  onReset,
  isDarkMode = false,
}) => {
  const [isVerified, setIsVerified] = useState(false);
  const [sliderVal, setSliderVal] = useState(0);
  const [challenge, setChallenge] = useState<{ q: string; a: number }>({ q: "", a: 0 });
  const [userAnswer, setUserAnswer] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [mode, setMode] = useState<"slider" | "math">("slider");

  // Generate random challenge
  const refreshChallenge = () => {
    const a = Math.floor(Math.random() * 8) + 2;
    const b = Math.floor(Math.random() * 8) + 1;
    setChallenge({ q: `${a} + ${b}`, a: a + b });
    setUserAnswer("");
    setSliderVal(0);
    setErrorMsg("");
    setIsVerified(false);
    onReset?.();
  };

  useEffect(() => {
    if (required) {
      refreshChallenge();
    }
  }, [required]);

  if (!required) {
    return null; // ZERO friction for normal trusted traffic
  }

  // Handle slider release
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setSliderVal(val);
    if (val >= 98) {
      completeVerification("slider_verified_" + Date.now());
    }
  };

  const handleMathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parseInt(userAnswer.trim(), 10) === challenge.a) {
      completeVerification("math_verified_" + Date.now());
    } else {
      setErrorMsg("Incorrect answer. Please try again.");
      refreshChallenge();
    }
  };

  const completeVerification = (token: string) => {
    setIsVerified(true);
    setErrorMsg("");
    onVerify(token);
  };

  return (
    <div
      className={`my-4 p-4 rounded-2xl border transition-all duration-300 ${
        isDarkMode
          ? "bg-slate-900/80 border-amber-500/30 text-white shadow-lg shadow-amber-950/20"
          : "bg-amber-50/80 border-amber-300/60 text-slate-800 shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isVerified ? (
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-amber-500 animate-pulse" />
          )}
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            {isVerified ? "Security Verified" : "Human Verification Required"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "slider" ? "math" : "slider");
            refreshChallenge();
          }}
          className="text-[11px] underline opacity-70 hover:opacity-100 flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          {mode === "slider" ? "Switch to Math" : "Switch to Slider"}
        </button>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
        {isVerified
          ? "Verification complete. You may proceed."
          : "Suspicious attempt or rate threshold reached. Please verify below."}
      </p>

      {isVerified ? (
        <div className="flex items-center justify-center gap-2 py-2 px-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          Passed Verification
        </div>
      ) : mode === "slider" ? (
        <div className="space-y-2">
          <div className="relative flex items-center h-10 bg-slate-200 dark:bg-slate-800 rounded-xl px-2 overflow-hidden border border-black/5 dark:border-white/10">
            <div
              className="absolute left-0 top-0 bottom-0 bg-emerald-500/30 transition-all"
              style={{ width: `${sliderVal}%` }}
            />
            <span className="w-full text-center text-xs font-medium text-slate-500 dark:text-slate-400 pointer-events-none select-none">
              Slide to the right to verify ➔
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={sliderVal}
              onChange={handleSliderChange}
              onMouseUp={() => sliderVal < 98 && setSliderVal(0)}
              onTouchEnd={() => sliderVal < 98 && setSliderVal(0)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700">
              {challenge.q} = ?
            </span>
            <input
              type="number"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Ans"
              className="w-20 px-3 py-1 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            <button
              type="button"
              onClick={handleMathSubmit}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Verify
            </button>
          </div>
          {errorMsg && <p className="text-[11px] text-red-500 font-medium">{errorMsg}</p>}
        </div>
      )}
    </div>
  );
};
export default SmartCaptcha;

