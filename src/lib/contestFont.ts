// src/lib/contestFont.ts — the exam font (Noto Sans, latin + devanagari), loaded only on contest pages.
import { useEffect } from "react";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap";

export const CONTEST_FONT_STACK = '"Noto Sans", "Noto Sans Devanagari", system-ui, Arial, sans-serif';
export const CONTEST_NAVY = "#1F3A68";

/** Adds the Google Fonts stylesheet once (display=swap: text shows at once in the fallback font). */
export function useContestFont(): void {
  useEffect(() => {
    if (document.getElementById("a4-contest-font")) return;
    const link = document.createElement("link");
    link.id = "a4-contest-font";
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);
}
