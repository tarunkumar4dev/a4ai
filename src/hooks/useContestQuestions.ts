import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const BUCKET = "question-images";
// Set this true if your bucket is PRIVATE and you want expiring links.
// Set false if your bucket is PUBLIC.
const USE_SIGNED_URLS = false;
// Signed URL validity (seconds) if using private bucket:
const SIGNED_URL_TTL = 60 * 60; // 1 hour

export type ContestQuestion = {
  id: string;
  contest_code: string;
  question_text: string;
  options: string[];
  correct_option: string;
  // We will return a fully usable URL here after resolution:
  image_url?: string | null;
};

function looksLikeHttp(url?: string | null) {
  return !!url && /^https?:\/\//i.test(url);
}

/**
 * Extract a storage path ("<path inside bucket>") from a full URL if possible.
 * Handles both /object/public/<bucket>/<path> and /object/sign/<bucket>/<path>.
 * If it can't parse, returns null.
 */
function extractPathFromSupabaseUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/"); // e.g. ["", "storage", "v1", "object", "sign", "<bucket>", "<path...>"]
    const idx = parts.findIndex((p) => p === "sign" || p === "public");
    if (idx === -1) return null;
    const bucket = parts[idx + 1];
    if (!bucket || bucket !== BUCKET) return null;
    const pathParts = parts.slice(idx + 2); // remainder after bucket
    const path = decodeURIComponent(pathParts.join("/"));
    return path || null;
  } catch {
    return null;
  }
}

export function useContestQuestions(code?: string) {
  const [questions, setQuestions] = useState<ContestQuestion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!code) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("questions")
        .select("id, contest_code, question_text, options, correct_option, image_url")
        .eq("contest_code", code)
        .order("created_at", { ascending: true });

      if (!isMounted) return;

      if (error) {
        setError(error.message);
        setQuestions([]);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as ContestQuestion[];

      // Resolve image URLs:
      const resolved = await Promise.all(
        rows.map(async (q) => {
          if (!q.image_url) return q;

          // Case 1: already a full http(s) URL -> use as is
          if (looksLikeHttp(q.image_url)) {
            // If you saved a signed URL and USE_SIGNED_URLS=false, we still keep it.
            return q;
          }

          // Case 2: you stored just a storage path like "Q1.jpg" or "folder/Q1.jpg"
          const path = q.image_url;

          if (!USE_SIGNED_URLS) {
            // public bucket:
            const pub = supabase.storage.from(BUCKET).getPublicUrl(path);
            return { ...q, image_url: pub.data.publicUrl };
          } else {
            // private bucket:
            const sig = await supabase.storage
              .from(BUCKET)
              .createSignedUrl(path, SIGNED_URL_TTL);
            return { ...q, image_url: sig.data?.signedUrl ?? null };
          }
        })
      );

      setQuestions(resolved);
      setLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [code]);

  return { questions, loading, error };
}
