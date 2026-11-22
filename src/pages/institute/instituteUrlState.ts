// src/pages/institute/instituteUrlState.ts
// The /institute view lives in the URL (tab, dept / section filter, student search), so Back from a student's
// profile — or a reload — lands on the same tab with the same filters instead of the Dashboard tab.
// Tab changes are history entries (Back goes to the previous tab); filters / search replace the current entry.

export const INSTITUTE_TABS = ["overview", "departments", "teachers", "students", "batches", "attendance", "analytics", "classes"] as const;
export type InstituteTab = (typeof INSTITUTE_TABS)[number];

export interface InstituteView { tab: InstituteTab; dept: string; section: string; q: string }

export function readInstituteView(sp: URLSearchParams): InstituteView {
  const t = sp.get("tab");
  return {
    tab: (INSTITUTE_TABS as readonly string[]).includes(t ?? "") ? (t as InstituteTab) : "overview",
    dept: sp.get("dept") ?? "",
    section: sp.get("section") ?? "",
    q: sp.get("q") ?? "",
  };
}

/** New search params with `patch` applied; "" / null / "overview" (the default tab) remove the key. */
export function patchInstituteView(sp: URLSearchParams, patch: Partial<InstituteView>): URLSearchParams {
  const next = new URLSearchParams(sp);
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === "" || (k === "tab" && v === "overview")) next.delete(k);
    else next.set(k, v);
  }
  return next;
}

/** Where a student profile's Back goes when there is no in-app history (opened in a new tab / from a link). */
export const INSTITUTE_STUDENTS_URL = "/institute?tab=students";

/* Scroll position of the dashboard's scroll area per URL, for Back / Forward (module memory: survives the page
   unmounting while a profile is open; not needed across reloads). */
const SCROLL = new Map<string, number>();
export const rememberScroll = (url: string, top: number) => {
  SCROLL.delete(url);
  SCROLL.set(url, top);
  if (SCROLL.size > 50) SCROLL.delete(SCROLL.keys().next().value as string);
};
export const recallScroll = (url: string) => SCROLL.get(url);
