// src/components/AddManualQuestionModal.tsx
// ──────────────────────────────────────────────────────────────────────
// Manual Question Add Modal
//
// Lets teachers add custom questions to a generated paper.
// Supports: MCQ, Short Answer, Long Answer, Image-based
//
// Flow:
//   1. Teacher selects question type (buttons)
//   2. Dynamic form appears based on type
//   3. Image upload → Supabase Storage → public URL
//   4. On save → parent adds to local question list
//   5. Persisted to DB when teacher clicks "Save & Finish"
// ──────────────────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ListChecks, AlignLeft, FileText, ImageIcon, Upload, Loader2,
  Check, AlertCircle, Trash2, Plus,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// ── Types ──────────────────────────────────────────────────────────────

export type ManualQuestionType = "mcq" | "short_answer" | "long_answer" | "image";

export interface ManualQuestion {
  id: string;
  isManual: true;                 // flag to distinguish from AI-generated
  type: ManualQuestionType;
  text: string;
  options?: string[];             // for MCQ
  correctAnswer: string;
  explanation?: string;           // model answer for short/long
  imageUrl?: string;              // for image-based
  marks: number;
  difficulty: "easy" | "medium" | "hard";
  chapter?: string;
  section?: string;               // CBSE section (A/B/C/D/E) if applicable
  status: "pending" | "approved" | "rejected" | "editing";
}

interface AddManualQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (question: ManualQuestion) => void;
  cbsePattern?: boolean;          // show section selector if CBSE paper
  testId?: string;                // used in image path
}

// ── UUID Helper ────────────────────────────────────────────────────────

const generateUUID = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// ── Question Type Cards ────────────────────────────────────────────────

const QUESTION_TYPES: {
  value: ManualQuestionType;
  label: string;
  desc: string;
  icon: any;
  color: string;
}[] = [
  {
    value: "mcq",
    label: "MCQ",
    desc: "Multiple choice with options",
    icon: ListChecks,
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    value: "short_answer",
    label: "Short Answer",
    desc: "2-3 sentence response",
    icon: AlignLeft,
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    value: "long_answer",
    label: "Long Answer",
    desc: "Detailed paragraph response",
    icon: FileText,
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    value: "image",
    label: "Image Based",
    desc: "Question with reference image",
    icon: ImageIcon,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
];

// ═══════════════════════════════════════════════════════════════════════
// IMAGE UPLOAD HELPER
// ═══════════════════════════════════════════════════════════════════════

async function uploadImageToSupabase(
  file: File,
  testId: string
): Promise<string> {
  // Validate size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be under 5MB");
  }
  // Validate type
  if (!file.type.startsWith("image/")) {
    throw new Error("File must be an image");
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `manual-questions/${testId}/${generateUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("question-images")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from("question-images").getPublicUrl(path);
  return data.publicUrl;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN MODAL COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export const AddManualQuestionModal: React.FC<AddManualQuestionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  cbsePattern = false,
  testId = "temp",
}) => {
  // ── State ────────────────────────────────────────────────────────────
  const [selectedType, setSelectedType] = useState<ManualQuestionType | null>(null);

  // Common fields
  const [questionText, setQuestionText] = useState("");
  const [marks, setMarks] = useState<number>(1);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [chapter, setChapter] = useState("");
  const [section, setSection] = useState("A");

  // MCQ fields
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [correctIdx, setCorrectIdx] = useState<number>(0);

  // Short/Long fields
  const [modelAnswer, setModelAnswer] = useState("");

  // Image fields
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Reset form ───────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setSelectedType(null);
    setQuestionText("");
    setMarks(1);
    setDifficulty("medium");
    setChapter("");
    setSection("A");
    setOptions(["", "", "", ""]);
    setCorrectIdx(0);
    setModelAnswer("");
    setImageFile(null);
    setImagePreview(null);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  // ── Image handling ───────────────────────────────────────────────────
  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    setError(null);
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const clearImage = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // ── Validation ───────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!selectedType) return "Select a question type";
    if (!questionText.trim()) return "Question text is required";
    if (questionText.trim().length < 5) return "Question text is too short";

    if (selectedType === "mcq") {
      const filled = options.filter((o) => o.trim().length > 0);
      if (filled.length < 2) return "MCQ needs at least 2 options";
      if (!options[correctIdx]?.trim()) return "Select a valid correct answer";
    }

    if (selectedType === "short_answer" || selectedType === "long_answer") {
      if (!modelAnswer.trim()) return "Model answer is required";
    }

    if (selectedType === "image") {
      if (!imageFile) return "Please upload an image";
      if (!modelAnswer.trim()) return "Answer/explanation is required";
    }

    return null;
  };

  // ── Save ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSaving(true);

    try {
      let imageUrl: string | undefined;

      if (selectedType === "image" && imageFile) {
        setImageUploading(true);
        imageUrl = await uploadImageToSupabase(imageFile, testId);
        setImageUploading(false);
      }

      const labels = ["A", "B", "C", "D"];
      const correctAnswer =
        selectedType === "mcq"
          ? `${labels[correctIdx]}) ${options[correctIdx]}`
          : modelAnswer;

      const question: ManualQuestion = {
        id: generateUUID(),
        isManual: true,
        type: selectedType!,
        text: questionText.trim(),
        marks,
        difficulty,
        correctAnswer,
        explanation: modelAnswer.trim() || undefined,
        status: "approved", // manual questions are approved by default
        chapter: chapter.trim() || "Manual Addition",
        ...(cbsePattern ? { section } : {}),
        ...(selectedType === "mcq"
          ? { options: options.filter((o) => o.trim().length > 0) }
          : {}),
        ...(imageUrl ? { imageUrl } : {}),
      };

      onSave(question);
      resetForm();
      onClose();
    } catch (err: any) {
      console.error("Failed to save manual question:", err);
      setError(err.message || "Failed to save question");
    } finally {
      setSaving(false);
      setImageUploading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────
  if (!isOpen) return null;

  const inputClass =
    "w-full min-h-[44px] bg-white border border-[#E5E7EB] rounded-xl px-3 py-2.5 text-sm font-semibold text-[#111827] outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-400/10 transition-all";
  const labelClass =
    "text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block";

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[#111827]/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
        className="relative z-10 bg-white w-full sm:max-w-2xl sm:rounded-[24px] rounded-t-[24px] sm:my-8 shadow-2xl max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#E5E7EB] flex justify-between items-center bg-[#F9FAFB] sm:rounded-t-[24px]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-gray-900 rounded-xl text-white flex-shrink-0">
              <Plus size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-[#111827] truncate">
                Add Manual Question
              </h3>
              <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {selectedType
                  ? QUESTION_TYPES.find((t) => t.value === selectedType)?.label
                  : "Select question type"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="min-w-[40px] min-h-[40px] p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-[#111827]"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* ── Type selector ── */}
          {!selectedType && (
            <div>
              <label className={labelClass}>Select Question Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {QUESTION_TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setSelectedType(t.value)}
                      className={`text-left p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${t.color} border-opacity-50 hover:border-opacity-100`}
                      style={{ WebkitTapHighlightColor: "transparent" }}
                    >
                      <div className="flex items-center gap-3 mb-1">
                        <Icon size={20} />
                        <span className="font-bold text-sm">{t.label}</span>
                      </div>
                      <p className="text-xs opacity-80">{t.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Form (after type selected) ── */}
          {selectedType && (
            <>
              {/* Change type link */}
              <button
                type="button"
                onClick={() => setSelectedType(null)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                ← Change question type
              </button>

              {/* ── Question Text ── */}
              <div>
                <label className={labelClass}>Question Text</label>
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Write your question here..."
                  rows={3}
                  className={`${inputClass} resize-y min-h-[80px]`}
                />
              </div>

              {/* ── Image upload (if image type) ── */}
              {selectedType === "image" && (
                <div>
                  <label className={labelClass}>Question Image</label>

                  {!imagePreview ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full min-h-[140px] border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-all active:scale-[0.99]"
                      style={{ WebkitTapHighlightColor: "transparent" }}
                    >
                      <Upload size={24} className="text-gray-400" />
                      <span className="text-sm font-semibold text-gray-600">
                        Tap to upload image
                      </span>
                      <span className="text-xs text-gray-400">
                        PNG, JPG, WEBP · Max 5MB
                      </span>
                    </button>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
                      <img
                        src={imagePreview}
                        alt="Question preview"
                        className="w-full max-h-[280px] object-contain"
                      />
                      <button
                        type="button"
                        onClick={clearImage}
                        className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors"
                        aria-label="Remove image"
                      >
                        <Trash2 size={14} />
                      </button>
                      {imageFile && (
                        <div className="p-2 bg-white border-t border-gray-100 text-xs text-gray-500 truncate">
                          {imageFile.name} ·{" "}
                          {(imageFile.size / 1024).toFixed(0)} KB
                        </div>
                      )}
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>
              )}

              {/* ── MCQ options ── */}
              {selectedType === "mcq" && (
                <div>
                  <label className={labelClass}>
                    Options · Tap the circle to mark correct answer
                  </label>
                  <div className="space-y-2">
                    {options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCorrectIdx(idx)}
                          className={`min-w-[36px] min-h-[36px] w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                            correctIdx === idx
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "bg-white border-gray-300 text-gray-500"
                          }`}
                          style={{ WebkitTapHighlightColor: "transparent" }}
                          aria-label={`Mark option ${String.fromCharCode(65 + idx)} as correct`}
                        >
                          {correctIdx === idx ? (
                            <Check size={14} />
                          ) : (
                            String.fromCharCode(65 + idx)
                          )}
                        </button>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const next = [...options];
                            next[idx] = e.target.value;
                            setOptions(next);
                          }}
                          placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                          className={inputClass}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Model Answer (for Short, Long, Image) ── */}
              {(selectedType === "short_answer" ||
                selectedType === "long_answer" ||
                selectedType === "image") && (
                <div>
                  <label className={labelClass}>
                    {selectedType === "image" ? "Answer / Explanation" : "Model Answer"}
                  </label>
                  <textarea
                    value={modelAnswer}
                    onChange={(e) => setModelAnswer(e.target.value)}
                    placeholder={
                      selectedType === "long_answer"
                        ? "Write the expected detailed answer..."
                        : "Write the expected answer..."
                    }
                    rows={selectedType === "long_answer" ? 5 : 3}
                    className={`${inputClass} resize-y`}
                  />
                </div>
              )}

              {/* ── Meta row (marks + difficulty) ── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Marks</label>
                  <select
                    value={marks}
                    onChange={(e) => setMarks(Number(e.target.value))}
                    className={`${inputClass} appearance-none`}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 10].map((n) => (
                      <option key={n} value={n}>
                        {n} marks
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className={`${inputClass} appearance-none`}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* ── Optional: chapter + section ── */}
              <div className={`grid grid-cols-1 ${cbsePattern ? "sm:grid-cols-2" : ""} gap-3`}>
                <div>
                  <label className={labelClass}>Chapter (optional)</label>
                  <input
                    type="text"
                    value={chapter}
                    onChange={(e) => setChapter(e.target.value)}
                    placeholder="e.g. Light"
                    className={inputClass}
                  />
                </div>
                {cbsePattern && (
                  <div>
                    <label className={labelClass}>CBSE Section</label>
                    <select
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      className={`${inputClass} appearance-none`}
                    >
                      <option value="A">Section A (MCQ · 1m)</option>
                      <option value="B">Section B (Short · 2m)</option>
                      <option value="C">Section C (Short · 3m)</option>
                      <option value="D">Section D (Long · 5m)</option>
                      <option value="E">Section E (Case · 4m)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* ── Error display ── */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-red-700">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {selectedType && (
          <div className="p-4 sm:p-5 border-t border-[#E5E7EB] bg-[#F9FAFB] flex gap-3 sm:rounded-b-[24px]">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="flex-1 sm:flex-none min-h-[44px] px-5 py-3 rounded-xl text-sm font-bold bg-white border border-gray-200 text-gray-700 active:bg-gray-100 transition-colors disabled:opacity-50"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-[1.5] sm:flex-none min-h-[44px] px-6 py-3 bg-gradient-to-br from-gray-800 to-gray-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:shadow-md transition-all disabled:opacity-60"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {imageUploading ? "Uploading image..." : "Saving..."}
                </>
              ) : (
                <>
                  <Check size={16} />
                  Add to Paper
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AddManualQuestionModal;