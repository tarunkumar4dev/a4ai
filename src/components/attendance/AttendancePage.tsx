// src/components/attendance/AttendancePage.tsx
// Wrapper — Teaching tab always, My Section tab auto-if proctor
// Drop this into your route/page file

import React, { useState } from "react";
import TeacherAttendanceView from "./TeacherAttendanceView";
import ProctorSectionView, { useProctorCheck } from "./ProctorSectionView";

type Tab = "teaching" | "section";

export default function AttendancePage() {
  const { isProctor } = useProctorCheck();
  const [tab, setTab] = useState<Tab>("teaching");

  return (
    <div className="w-full">
      {/* Tab bar — horizontal scroll on small screens */}
      <div className="flex gap-0.5 mb-4 sm:mb-6 overflow-x-auto scrollbar-none -mx-1 px-1">
        <button onClick={() => setTab("teaching")}
          className={`relative px-4 sm:px-6 py-3 font-bold text-sm sm:text-base transition-colors whitespace-nowrap shrink-0 touch-manipulation active:scale-[0.97] ${
            tab === "teaching" ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"
          }`}>
          Teaching
          {tab === "teaching" && (
            <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-full"
              style={{ background: "linear-gradient(90deg, var(--theme-start, #3b82f6), var(--theme-end, #8b5cf6))" }} />
          )}
        </button>

        {isProctor && (
          <button onClick={() => setTab("section")}
            className={`relative px-4 sm:px-6 py-3 font-bold text-sm sm:text-base transition-colors whitespace-nowrap shrink-0 touch-manipulation active:scale-[0.97] ${
              tab === "section" ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"
            }`}>
            My Section
            {tab === "section" && (
              <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-full"
                style={{ background: "linear-gradient(90deg, var(--theme-start, #3b82f6), var(--theme-end, #8b5cf6))" }} />
            )}
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-200/60 dark:bg-white/5 -mt-4 sm:-mt-6 mb-4 sm:mb-6" />

      {/* Content */}
      {tab === "teaching" && <TeacherAttendanceView />}
      {tab === "section" && isProctor && <ProctorSectionView />}
    </div>
  );
}