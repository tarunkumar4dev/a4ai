// src/lib/uploadLink/storageUpload.ts
// Direct upload into the private "submissions" bucket as anon, with progress (supabase-js has no progress
// callback, so this is the same Storage REST call over XHR). Path rule (api doc 2.3 / storage rules):
//   <institute_id>/<assignment_id>/<student_id>/<uuid>.<ext>, upsert false.

const URL_BASE = (import.meta.env.VITE_SUPABASE_URL || "https://example.supabase.co").replace(/\/+$/, "");
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "public-anon-key";

export const BUCKET = "submissions";

export const uploadPath = (instituteId: string, assignmentId: string, studentId: string, ext: string) =>
  `${instituteId}/${assignmentId}/${studentId}/${crypto.randomUUID()}.${ext}`;

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
        reject(new UploadError("File bahut badi hai (max 10 MB)."));
      } else if (xhr.status === 403 || /row-level security|policy/i.test(xhr.responseText)) {
        reject(new UploadError("Upload band hai — link ka time khatam ho gaya ya ye format allowed nahi."));
      } else {
        reject(new UploadError("Upload nahi ho paya. Retry dabao."));
      }
    };
    xhr.onerror = () => reject(new UploadError("Internet slow hai ya band hai. Retry dabao."));
    xhr.onabort = () => reject(new UploadError("Upload ruk gaya."));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(blob);
  });
}
