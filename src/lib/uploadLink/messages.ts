// src/lib/uploadLink/messages.ts — English text for the codes the server sends (create_submission file errors and
// warnings, migration 18; reject_reasons written by the check worker). The server's own `message` is not shown:
// the UI decides the wording, the server only says what went wrong.

export interface CodedMessage { code: string; message?: string; index?: number; page_order?: number }

const page = (n?: number) => (n ? `Page ${n}` : "A page");

/** create_submission → invalid_files.errors[] (index = position in p_files = page number). */
export function fileErrorText(e: CodedMessage, maxMb?: number): string {
  const p = page(e.index ?? e.page_order);
  switch (e.code) {
    case "no_files": return "Add at least one page.";
    case "too_many_files": return "Too many pages for this test. Remove some.";
    case "bad_entry": return `${p}: something is wrong with this file. Remove it and add it again.`;
    case "bad_path": return `${p} was uploaded to the wrong place. Reload the page and add it again.`;
    case "duplicate_file": return `${p} is in the list twice.`;
    case "bad_page_order": return "The page order got mixed up. Reload the page and try again.";
    case "bad_format": return `${p}: this file type isn't allowed.`;
    case "bad_sha256": return `${p}: the file check failed. Reload the page and try again.`;
    case "not_uploaded": return `${p} didn't finish uploading. Tap Submit to upload it again.`;
    case "empty_file": return `${p} is empty.`;
    case "too_large": return `${p} is too large${maxMb ? ` (max ${maxMb} MB)` : ""}.`;
    case "file_reused": return `${p} was already used in an earlier upload. Add a new photo.`;
    default: return `${p} can't be used. Add it again.`;
  }
}

/** create_submission → warnings[] */
export function warningText(w: CodedMessage): string {
  if (w.code === "same_as_earlier_upload") return `${page(w.page_order)} is the same file as an earlier upload.`;
  return `Check ${page(w.page_order).toLowerCase()}.`;
}

/** submissions.reject_reasons[] (the worker could not read the copy). Unknown codes get a general line. */
export function rejectText(r: CodedMessage): string {
  const p = r.page_order ? `Page ${r.page_order}: ` : "";
  const c = `${r.code} ${r.message || ""}`.toLowerCase();
  if (/pass(word)?|needs_pass/.test(c)) return `${p}this PDF has a password. Upload one without a password.`;
  if (/blank|empty/.test(c)) return `${p}the page looks blank. Upload a clear photo.`;
  if (/dup|same/.test(c)) return `${p}this is the same file as another page.`;
  if (/too_many|pages|large|size/.test(c)) return `${p}the file is too large or has too many pages.`;
  if (/type|format|magic|mime/.test(c)) return `${p}this file type can't be read. Upload a photo or PDF.`;
  return `${p}this file couldn't be read. Upload a clear photo or PDF.`;
}
