// src/hooks/useTestGenerator.ts

import { useState, useCallback } from "react";
import { api, GenerateTestResponse, ApiError } from "@/lib/api";
import type { FormSchema } from "@/lib/schema";
import { FORMAT_MAP } from "@/components/TestRowEditor";

export interface UseTestGeneratorReturn {
  generate: (formData: FormSchema) => Promise<void>;
  isLoading: boolean;
  result: GenerateTestResponse | null;
  error: string | null;
  reset: () => void;
  progress: string;
}

export function useTestGenerator(): UseTestGeneratorReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GenerateTestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setProgress("");
  }, []);

  const generate = useCallback(async (formData: FormSchema) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Step 1: Validate form
      setProgress("Validating form data...");

      const totalQuestions = formData.simpleData.reduce(
        (sum, row) => sum + (row.quantity || 0),
        0
      );

      if (totalQuestions === 0) {
        throw new Error("Add at least one chapter with questions");
      }

      if (totalQuestions > 50) {
        throw new Error(
          `Too many questions (${totalQuestions}). Maximum 50 per test for best quality.`
        );
      }

      // Step 2: Transform form data → API payload
      setProgress("Preparing request...");

      const payload = {
        examTitle: formData.examTitle || "Untitled Test",
        board: formData.board || "CBSE",
        classGrade: formData.classGrade || "Class 10",
        subject: formData.subject || "Science",
        simpleData: formData.simpleData
          .filter((row) => row.topic)
          .map((row) => {
            // ═══════════════════════════════════════════════════
            // FIX: Convert frontend format ("Short", "Long", etc.)
            //      to backend format ("short_answer", "long_answer")
            //      using FORMAT_MAP from TestRowEditor
            //
            // BUG WAS: format: row.format || "mcq"
            //   → sent "Short"/"Long" directly, backend didn't
            //     recognize these → defaulted to MCQ for everything
            // ═══════════════════════════════════════════════════
            const frontendFormat = row.format || "MCQ";
            const backendFormat = FORMAT_MAP[frontendFormat] || frontendFormat.toLowerCase() || "mcq";

            // Auto-set marks based on format if user left default (1m)
            const defaultMarks: Record<string, number> = {
              mcq: 1,
              short_answer: 2,
              long_answer: 5,
              assertion_reason: 1,
              journal_entry: 4,
              ledger: 6,
              trial_balance: 6,
            };

            const marks = row.marks || defaultMarks[backendFormat] || 1;

            return {
              topic: row.topic,
              subtopic: row.subtopic || undefined,
              quantity: row.quantity || 5,
              marks: marks,
              difficulty: row.difficulty || "Medium",
              format: backendFormat,
            };
          }),
        mode: formData.mode || "Simple",
        enableWatermark: formData.enableWatermark ?? true,
        shuffleQuestions: formData.shuffleQuestions ?? false,
        useNCERT: true,
        ncertChapters: formData.ncertChapters || [],
        userId: formData.userId || undefined,
        cbsePattern: formData.cbsePattern ?? false,
      };

      // Step 3: Call backend
      const formatSummary = payload.simpleData
        .map((r) => `${r.quantity}× ${r.format}`)
        .join(", ");

      setProgress(
        payload.cbsePattern
          ? `Generating CBSE Pattern paper (38 questions, 80 marks)... This may take 60-120 seconds.`
          : `Generating ${totalQuestions} questions (${formatSummary}) with NCERT RAG... This may take 30-90 seconds.`
      );

      console.log("[useTestGenerator] Payload formats:", payload.simpleData.map(r => ({
        topic: r.topic,
        format: r.format,
        marks: r.marks,
        quantity: r.quantity,
      })));

      const response = await api.generateTest(payload);

      if (!response.ok) {
        throw new Error("Generation failed — please try again");
      }

      setResult(response);
      setProgress(
        `Done! ${response.totalQuestions} questions generated in ${response.generationTime}s`
      );
    } catch (err: any) {
      console.error("Generation error:", err);

      if (err instanceof ApiError) {
        if (err.status === 403) {
          // Usage limit reached
          const detail = typeof err.detail === "object" ? err.detail : {};
          setError(
            detail.message ||
              "Monthly limit reached. Upgrade your plan to generate more tests."
          );
        } else if (err.status === 422) {
          setError(`Invalid input: ${typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)}`);
        } else if (err.status === 429) {
          setError(
            "Rate limit reached. Please wait a minute and try again."
          );
        } else if (err.status === 500) {
          setError(
            "Server error — our AI is temporarily overloaded. Try again in 30 seconds."
          );
        } else {
          setError(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
        }
      } else {
        setError(err.message || "Unexpected error occurred");
      }

      setProgress("");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { generate, isLoading, result, error, reset, progress };
}