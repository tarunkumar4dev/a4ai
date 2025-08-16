import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type Question = {
  id: string;
  contest_code: string;
  question_text: string;
  options: string[];       // Supabase text[] maps to string[]
  correct_option: string;  // matches your table
};

export function useContestQuestions(code?: string) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("questions")
        .select("id, contest_code, question_text, options, correct_option")
        .eq("contest_code", code)
        .order("created_at", { ascending: true });
      if (!error) setQuestions((data ?? []) as Question[]);
      setLoading(false);
    })();
  }, [code]);

  return { questions, loading };
}