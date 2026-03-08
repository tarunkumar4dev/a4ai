// src/hooks/useTestGenerator.ts
// ──────────────────────────────────────────────────────────────────────
// Hook that connects TestGeneratorForm → FastAPI backend.
//
// Usage in TestGeneratorForm.tsx:
//   const { generate, isLoading, result, error } = useTestGenerator();
//   const onSubmit = (data) => generate(data);
// ──────────────────────────────────────────────────────────────────────

import { useState, useCallback } from "react";
import { api, GenerateTestResponse, ApiError } from "@/lib/api";
import type { FormSchema } from "@/lib/schema";

export interface UseTestGeneratorReturn {
  generate: (formData: FormSchema) => Promise<void>;
  isLoading: boolean;
  result: GenerateTestResponse | null;
  error: string | null;
  reset: () => void;
  progress: string;   // Live status message for UI
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
        (sum, row) => sum + (row.quantity || 0), 0
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
          .filter((row) => row.topic)              // Skip empty rows
          .map((row) => ({
            topic: row.topic,
            subtopic: row.subtopic || undefined,
            quantity: row.quantity || 5,
            difficulty: row.difficulty || "Medium",
            format: row.format || "PDF",
          })),
        mode: formData.mode || "Simple",
        enableWatermark: formData.enableWatermark ?? true,
        shuffleQuestions: formData.shuffleQuestions ?? false,
        useNCERT: true,
        ncertChapters: formData.ncertChapters || [],
        userId: formData.userId || undefined,
      };

      // Step 3: Call backend
      setProgress(
        `Generating ${totalQuestions} questions with NCERT RAG... This may take 30-90 seconds.`
      );

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
        if (err.status === 422) {
          setError(`Invalid input: ${err.detail}`);
        } else if (err.status === 429) {
          setError("Rate limit reached. Please wait a minute and try again.");
        } else if (err.status === 500) {
          setError("Server error — our AI is temporarily overloaded. Try again in 30 seconds.");
        } else {
          setError(err.detail);
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