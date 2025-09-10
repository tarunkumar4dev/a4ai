import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ---------- Types ---------- */
export type Question = {
  id: string;
  contest_code: string;
  question_text: string;
  options: string[];        // Supabase text[] → string[]
  correct_option: string;   // matches your table
};

export type ContestMeta = {
  title?: string;
  durationMinutes?: number;
  total?: number;           // number of questions
};

export type UseContestQuestionsResult = {
  questions: Question[];
  loading: boolean;
  error?: string;
  meta?: ContestMeta | null;
};

/* ---------- Hook ---------- */
export function useContestQuestions(code?: string | null): UseContestQuestionsResult {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [meta, setMeta] = useState<ContestMeta | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // Reset when no code
        if (!code) {
          if (!alive) return;
          setQuestions([]);
          setMeta(null);
          setLoading(false);
          setError(undefined);
          return;
        }

        setLoading(true);
        setError(undefined);

        // Fetch contest meta (adjust column names if different in your schema)
        const { data: contest, error: contestErr } = await supabase
          .from("contests")
          .select("title, duration_minutes")
          .eq("code", code)
          .maybeSingle();

        if (contestErr) throw contestErr;

        // Fetch questions
        const { data: qData, error: qErr } = await supabase
          .from("questions")
          .select("id, contest_code, question_text, options, correct_option, created_at")
          .eq("contest_code", code)
          .order("created_at", { ascending: true });

        if (qErr) throw qErr;

        if (!alive) return;

        const qs: Question[] = (qData ?? []).map((row: any) => ({
          id: String(row.id),
          contest_code: String(row.contest_code),
          question_text: String(row.question_text),
          options: (row.options ?? []) as string[],
          correct_option: String(row.correct_option ?? ""),
        }));

        setQuestions(qs);
        setMeta({
          title: contest?.title ?? "Contest",
          durationMinutes: contest?.duration_minutes ?? 30, // default if null/missing
          total: qs.length,
        });
      } catch (e: any) {
        if (!alive) return;
        setQuestions([]);
        setMeta(null);
        setError(e?.message ?? "Failed to load contest data");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [code]);

  return { questions, loading, error, meta };
}
