import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type ContestQuestion = {
  id: string;
  contest_code: string;
  question_text: string;
  options: string[];
  correct_option: string;
};

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
        .select("id, contest_code, question_text, options, correct_option")
        .eq("contest_code", code)
        .order("created_at", { ascending: true });

      if (!isMounted) return;
      if (error) {
        setError(error.message);
        setQuestions([]);
      } else {
        setQuestions((data ?? []) as ContestQuestion[]);
      }
      setLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [code]);

  return { questions, loading, error };
}
