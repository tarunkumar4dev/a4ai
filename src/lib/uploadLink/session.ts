// src/lib/uploadLink/session.ts
// What survives a refresh during an upload (localStorage; the page blobs live in IndexedDB, blobStore.ts):
//   a4ai_link_code_<token>                  the verified + confirmed access code for one shared link
//   a4ai_upload_draft_<assignment>_<code>   pages picked so far + their Storage path once uploaded
// The idempotency key of the attempt is kept by attemptKey() in src/lib/uploadFlow.ts.

export interface DraftItem {
  id: string;                 // local id = IndexedDB key of the prepared blob
  name: string;
  mime: string;
  ext: string;
  size: number;
  sha256: string;
  pages: number;              // PDF page count (pdf.js); 1 for a photo
  warning: string | null;     // "Photo looks unclear. Retake?"
  path: string | null;        // Storage path once uploaded — a retry / refresh never uploads it again
}

const safeGet = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode / full */ } };
const safeDel = (k: string) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };

const codeKey = (token: string) => `a4ai_link_code_${token}`;
const draftKey = (assignmentId: string, code: string) => `a4ai_upload_draft_${assignmentId}_${code}`;

/** Paste friendly: spaces / dashes dropped, upper-cased, max 8 characters. */
export const cleanCode = (v: string) => v.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8);

export const loadCode = (token: string) => safeGet(codeKey(token));
export const saveCode = (token: string, code: string) => safeSet(codeKey(token), code);
export const clearCode = (token: string) => safeDel(codeKey(token));

export function loadDraft(assignmentId: string, code: string): DraftItem[] {
  try {
    const items = JSON.parse(safeGet(draftKey(assignmentId, code)) || "[]");
    if (Array.isArray(items)) return items.filter(i => i && typeof i.id === "string");
  } catch { /* corrupt → start fresh */ }
  return [];
}

export const saveDraft = (assignmentId: string, code: string, items: DraftItem[]) =>
  items.length ? safeSet(draftKey(assignmentId, code), JSON.stringify(items)) : safeDel(draftKey(assignmentId, code));
export const clearDraft = (assignmentId: string, code: string) => safeDel(draftKey(assignmentId, code));

/** Pages that still have to go to Storage (resume after a drop / refresh uploads only these). */
export const pendingUploads = (items: DraftItem[]) => items.filter(i => !i.path);

/** After a refresh: pages whose blob survived come back; uploaded pages are kept even without a blob. */
export function resumeItems(items: DraftItem[], hasBlob: (id: string) => boolean): { kept: DraftItem[]; lost: number } {
  const kept = items.filter(i => i.path || hasBlob(i.id));
  return { kept, lost: items.length - kept.length };
}

export const totalPages = (items: Pick<DraftItem, "pages">[]) => items.reduce((n, i) => n + (i.pages || 1), 0);
