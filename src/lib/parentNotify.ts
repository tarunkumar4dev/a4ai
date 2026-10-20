// src/lib/parentNotify.ts
// Parent WhatsApp number (students.parent_phone, stored as "+91XXXXXXXXXX") and the
// attendance message a teacher sends through a wa.me link. No API — the teacher's own WhatsApp sends it.

export type NotifyStatus = "present" | "absent" | "leave";

/** "98765 43210" / "+91-98765-43210" / "098765 43210" / "919876543210" → "9876543210", else null. */
export function indianMobile10(raw: string | null | undefined): string | null {
  let d = (raw || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

/** Value to save in students.parent_phone. */
export function toStoredParentPhone(raw: string): string | null {
  const d = indianMobile10(raw);
  return d ? `+91${d}` : null;
}

/** "20 Oct 2026" */
export function formatNotifyDate(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

const STATUS_TEXT: Record<NotifyStatus, string> = {
  absent: "*ANUPASTHIT (Absent)*",
  leave: "*chhutti pe (On leave)*",
  present: "*upasthit (Present)*",
};

export function buildAttendanceMessage(p: {
  instituteName: string;
  studentName: string;
  className: string;
  date: Date;
  subject?: string | null;
  status: NotifyStatus;
  teacherName: string;
}): string {
  const subject = (p.subject || "").trim() || p.className;
  return (
    `Namaste, ${p.instituteName} se soochna: ${p.studentName} (${p.className}) aaj ${formatNotifyDate(p.date)} ko ` +
    `${subject} class mein ${STATUS_TEXT[p.status]} rahe. Kisi sawaal ke liye ${p.teacherName} se sampark karein. ` +
    `– ${p.instituteName}`
  );
}

/** wa.me link, or null when the number isn't a valid Indian mobile. */
export function waLink(parentPhone: string | null | undefined, message: string): string | null {
  const d = indianMobile10(parentPhone);
  return d ? `https://wa.me/91${d}?text=${encodeURIComponent(message)}` : null;
}
