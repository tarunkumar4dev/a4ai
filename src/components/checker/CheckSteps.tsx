// src/components/checker/CheckSteps.tsx
// "Where am I?" for a check: 1 Marking scheme → 2 Students → 3 Copies → 4 Review & approve.
// The current step is derived from the data, so a new teacher always sees what to do next.

import React from "react";
import { Check } from "lucide-react";
import type { CheckSheet } from "./copyCheckerApi";

const STEPS = ["Marking scheme", "Students", "Copies", "Review & approve"];

const HINT: Record<number, string> = {
  1: "Prepare the marking scheme first — every copy is checked against it.",
  2: "Add the students whose copies you will check.",
  3: "Open a student and photograph their copy. Checking starts when you tap Done.",
  4: "Look at answers marked Review, change marks if needed, then approve.",
  5: "All copies approved. Export the results or look at the class analytics.",
};

/** 1-4 = current step, 5 = everything done. */
export function currentStep(rubricReady: boolean, sheets: CheckSheet[]): number {
  if (!rubricReady) return 1;
  if (!sheets.length) return 2;
  if (!sheets.some(s => s.status === "checked" || s.status === "approved")) return 3;
  if (sheets.every(s => s.status === "approved")) return 5;
  return 4;
}

export default function CheckSteps({ step }: { step: number }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 px-3 py-3">
      <ol className="flex items-center gap-1">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <li key={label} className="flex-1 flex items-center gap-1.5 min-w-0">
              <span className={`h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-black ${
                done ? "bg-emerald-600 text-white" : active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"}`}>
                {done ? <Check size={13} strokeWidth={3} /> : n}
              </span>
              <span className={`text-[11px] leading-tight truncate ${active ? "font-black text-gray-900" : done ? "font-bold text-gray-600" : "font-bold text-gray-400"}`}>
                {label}
              </span>
              {n < STEPS.length && <span className={`hidden sm:block flex-1 h-px ${done ? "bg-emerald-300" : "bg-gray-200"}`} />}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-gray-600">{HINT[step]}</p>
    </div>
  );
}
