// src/lib/uploadLink/storageUpload.ts
// Direct upload into the private "submissions" bucket as anon, with progress (supabase-js has no progress
// callback, so this is the same Storage REST call over XHR). Path rule (api doc 2.3 / storage rules):
//   <institute_id>/<assignment_id>/<student_id>/<uuid>.<ext>, upsert false.

const URL_BASE = (import.meta.env.VITE_SUPABASE_URL || "https://example.supabase.co").replace(/\/+$/, "");
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "public-anon-key";

export const BUCKET = "submissions";

export const uploadPath = (instituteId: string, assignmentId: string, studentId: string, ext: string) =>
  uploadPathIn(`${instituteId}/${assignmentId}/${studentId}/`, ext);

/** Open link (23): the folder comes from open_start — <institute>/<assignment>/guest/<submitter_key>/ */
export const uploadPathIn = (prefix: string, ext: string) => `${prefix}${crypto.randomUUID()}.${ext}`;

export class UploadError extends Error {}

export function uploadWithProgress(path: string, blob: Blob, mime: string, onProgress: (pct: number) => void,
                                   signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${URL_BASE}/storage/v1/object/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`);
    xhr.setRequestHeader("apikey", ANON);
    xhr.setRequestHeader("Authorization", `Bearer ${ANON}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", mime);
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      // Our path has a fresh uuid, so "already exists" means an earlier try got through before the drop.
      if ((xhr.status >= 200 && xhr.status < 300) || /already exists|duplicate/i.test(xhr.responseText)) {
        onProgress(100);
        resolve();
      } else if (xhr.status === 413 || /size/i.test(xhr.responseText)) {
        reject(new UploadError("File too large (max 10 MB)."));
      } else if (xhr.status === 403 || /row-level security|policy/i.test(xhr.responseText)) {
        reject(new UploadError("Upload refused — the link has closed or this format isn't allowed."));
      } else {
        reject(new UploadError("Upload failed. Tap Retry."));
      }
    };
    xhr.onerror = () => reject(new UploadError("No internet or a slow connection. Tap Retry."));
    xhr.onabort = () => reject(new UploadError("Upload stopped."));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(blob);
  });
}
