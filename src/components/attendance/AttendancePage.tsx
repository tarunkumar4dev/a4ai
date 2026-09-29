// src/components/attendance/AttendancePage.tsx
// Teacher dashboard → "Attendance" tab = marking my own classes.
// The proctor (class teacher) dashboard lives in its own "My Section" tab of the teacher
// dashboard, so it is not duplicated here — proctors just get a shortcut banner.

import React from "react";
import TeacherAttendanceView from "./TeacherAttendanceView";
import { useProctorCheck } from "./ProctorSectionView";

export default function AttendancePage({ onOpenSection }: {
  /** Switch the teacher dashboard to the "My Section" tab. Optional. */
  onOpenSection?: () => void;
} = {}) {
  const { isProctor, proctorSections } = useProctorCheck();

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {isProctor && (
        <div className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 border border-teal-200/70 dark:border-teal-800/40 bg-teal-50/70 dark:bg-teal-950/20">
          <p className="text-xs sm:text-sm font-semibold text-teal-800 dark:text-teal-300 min-w-0">
            You're class teacher of <b>{proctorSections.map(s => s.name).join(", ")}</b> — see every subject's marking, correct marks and export the monthly sheet.
          </p>
          {onOpenSection && (
            <button onClick={onOpenSection}
              className="shrink-0 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 active:scale-95 touch-manipulation">
              My Section →
            </button>
          )}
        </div>
      )}
      <TeacherAttendanceView />
    </div>
  );
}