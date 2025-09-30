// /src/lib/uploadRefs.ts
import { supabase } from "@/lib/supabaseClient";

const REFS_BUCKET = import.meta.env.VITE_REFS_BUCKET || "papers";

export type RefFileMeta = { name: string; path: string };

function extFromName(name: string) {
  const m = name.toLowerCase().match(/\.[a-z0-9]+$/);
  return m ? m[0] : "";
}

function inferContentType(name: string, fallback?: string) {
  const ext = extFromName(name);
  if (fallback) return fallback;
  if (ext === ".txt") return "text/plain";
  if (ext === ".csv") return "text/csv";
  if (ext === ".md") return "text/markdown";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}

export async function uploadReferenceFiles(
  files: File[] | undefined,
  userId: string,
  requestId: string
): Promise<RefFileMeta[]> {
  if (!files?.length) return [];

  const out: RefFileMeta[] = [];
  for (const file of files) {
    const path = `${userId}/${requestId}/${file.name}`;
    const { error } = await supabase.storage
      .from(REFS_BUCKET)
      .upload(path, file, {
        upsert: true,
        contentType: inferContentType(file.name, file.type),
      });

    if (error) {
      // don’t throw whole op; just skip this file
      console.warn("uploadReferenceFiles: upload failed", file.name, error.message);
      continue;
    }
    out.push({ name: file.name, path });
  }
  return out;
}
