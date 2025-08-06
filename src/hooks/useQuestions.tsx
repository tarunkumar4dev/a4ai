// src/hooks/useQuestions.ts
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export interface Question {
  id: string;
  contest_code: string;
  question_text: string;
  options: string[];
  correct_option: string;
}

export function useQuestions(contestCode: string) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("questions")
        .select("id, contest_code, question_text, options, correct_option")
        .eq("contest_code", contestCode);

      if (error) console.error("Error fetching questions:", error);
      else setQuestions(data as Question[]);

      setLoading(false);
    };

    if (contestCode) fetchQuestions();
  }, [contestCode]);

  return { questions, loading };
}
