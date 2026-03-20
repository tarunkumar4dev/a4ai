// src/pages/ContestPage.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { contestApi, ContestData } from "@/lib/contestApi";
import ContestAttemptPage from "@/components/contest/ContestAttemptPage";

export default function ContestPage() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const [contestData, setContestData] = useState<ContestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shortCode) return;
    
    contestApi.startAttempt(shortCode)
      .then(setContestData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [shortCode]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading contest...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-500">Error: {error}</div>;
  if (!contestData) return <div className="min-h-screen flex items-center justify-center text-gray-500">Contest not found</div>;

  return (
    <ContestAttemptPage
      config={{
        contestId: contestData.contest_id,
        attemptId: contestData.attempt_id,
        title: contestData.title,
        subject: contestData.subject,
        classGrade: contestData.class_grade,
        totalMarks: contestData.questions.reduce((s, q) => s + q.marks, 0),
        totalQuestions: contestData.questions.length,
        durationMinutes: contestData.duration_minutes,
        teacherName: "",
        showInstantAnswers: contestData.answer_mode === "instant",
        showAnswersAfterTest: contestData.answer_mode === "after_test",
        showNoAnswers: contestData.answer_mode === "none",
        showExplanation: contestData.show_explanation,
        allowBackNavigation: contestData.allow_back_navigation,
        enableCamera: contestData.enable_camera,
        enableTabDetection: contestData.enable_tab_detection,
        maxWarnings: contestData.max_warnings,
        questions: contestData.questions.map((q) => ({
          ...q,
          questionNumber: q.question_number,
          questionText: q.question_text,
          type: q.question_type as any,
          options: q.options || [],
        })),
      }}
    />
  );
}