// src/lib/parentNotify.ts
// Parent WhatsApp number (students.parent_phone, stored as "+91XXXXXXXXXX") and the attendance
// message a teacher sends through a wa.me link. No WhatsApp Business API and no delivery receipt —
// the link only opens the teacher's own WhatsApp with the message prefilled; they press Send.

export type NotifyStatus = "present" | "absent" | "leave";

/** "98765 43210" / "+91-98765-43210" / "098765 43210" / "919876543210" → "9876543210", else null. */
export function indianMobile10(raw: string | null | undefined): string | null {
  let d = (raw || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

/** Value to save in students.parent_phone, or null when the input isn't an Indian mobile. */
export function toStoredParentPhone(raw: string): string | null {
  const d = indianMobile10(raw);
  return d ? `+91${d}` : null;
}

/** Read-mode display: "••••3210". Empty string when there is no usable number. */
export function maskParentPhone(raw: string | null | undefined): string {
  const d = indianMobile10(raw);
  return d ? `••••${d.slice(-4)}` : "";
}

/** "30 Oct 2026" */
export function formatNotifyDate(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

const STATUS_TEXT: Record<NotifyStatus, string> = {
  absent: "ABSENT",
  leave: "ON LEAVE",
  present: "PRESENT",
};

export function buildAttendanceMessage(p: {
  guardianName?: string | null;
  instituteName: string;
  studentName: string;
  sectionName: string;
  subjectName?: string | null;
  teacherName: string;
  status: NotifyStatus;
  date: Date;
}): string {
  const guardian = (p.guardianName || "").trim() || "Parent/Guardian";
  const subject = (p.subjectName || "").trim() || p.sectionName;
  return (
    `Hi ${guardian}, this is a message from ${p.instituteName}.\n\n` +
    `This is to inform you that ${p.studentName} (${p.sectionName}) was marked ` +
    `*${STATUS_TEXT[p.status]}* in ${subject} class today, ${formatNotifyDate(p.date)}.\n\n` +
    `For any queries, please contact ${p.teacherName}.\n\n` +
    `— ${p.instituteName}`
  );
}

/** wa.me uses the country code without "+". Null when the number isn't a valid Indian mobile. */
export function waLink(parentPhone: string | null | undefined, message: string): string | null {
  const d = indianMobile10(parentPhone);
  return d ? `https://wa.me/91${d}?text=${encodeURIComponent(message)}` : null;
}

/** One named window so every click reuses the same WhatsApp tab instead of opening a new one. */
export const WA_WINDOW = "a4ai_wa";
