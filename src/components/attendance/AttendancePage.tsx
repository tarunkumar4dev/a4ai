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
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-slate-900">
          <p className="min-w-0 text-sm text-[#1B1B1B] dark:text-slate-200">
            You're class teacher of <b>{proctorSections.map(s => s.name).join(", ")}</b>. See every subject's marking, correct marks and export the monthly sheet in My Section.
          </p>
          {onOpenSection && (
            <button type="button" onClick={onOpenSection}
              className="inline-flex min-h-[44px] shrink-0 items-center rounded-xl border border-gray-200 px-3.5 text-sm font-semibold text-[#1B1B1B] hover:bg-gray-50 touch-manipulation dark:border-white/10 dark:text-white dark:hover:bg-slate-800">
              My Section
            </button>
          )}
        </div>
      )}
      <TeacherAttendanceView />
    </div>
  );
}