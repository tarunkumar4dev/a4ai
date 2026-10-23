// src/lib/whatsapp.ts — one place for "open WhatsApp with a prefilled message" (was inline in TeacherStudentsTab).

/** Indian numbers: digits only; a 10-digit number gets the 91 country code. */
export function waPhone(raw: string | null | undefined): string | null {
  const clean = (raw || "").replace(/\D/g, "");
  if (!clean) return null;
  return clean.startsWith("91") ? clean : clean.length === 10 ? `91${clean}` : clean;
}

/** wa.me link; without a phone WhatsApp lets the user pick the chat / group. */
export function waLink(text: string, phone?: string | null): string {
  const p = waPhone(phone);
  return `https://wa.me/${p ?? ""}?text=${encodeURIComponent(text)}`;
}

export function openWhatsApp(text: string, phone?: string | null): void {
  window.open(waLink(text, phone), "_blank");
}
