// src/components/TestGeneratorForm.tsx - OPTIMIZED & REFINED VERSION
import React, { useMemo, useCallback } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

/* ===================== OPTIMIZED UTILITIES ===================== */
const safeNumber = (value: unknown, defaultValue = 0): number => {
  if (value == null || value === "") return defaultValue;
  
  const num = typeof value === 'string' 
    ? Number(value.trim().replace(/,/g, ''))
    : Number(value);
  
  return Number.isNaN(num) ? defaultValue : num;
};

const safeInt = (value: unknown, defaultValue = 0): number => {
  return Math.floor(safeNumber(value, defaultValue));
};

/* ===================== STREAMLINED SCHEMAS ===================== */
const CognitiveLevelSchema = z.enum(["recall", "understand", "apply", "analyze"]);
const QuestionTypeSchema = z.enum(["mcq", "short", "long", "numerical", "case_based"]);
const DifficultyLevelSchema = z.enum(["easy", "medium", "hard"]);

const BaseNumberField = z.preprocess(
  (val) => safeNumber(val),
  z.number().min(0)
);

const BaseIntField = z.preprocess(
  (val) => safeInt(val),
  z.number().int().min(0)
);

const QuestionBucketSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  type: QuestionTypeSchema,
  difficulty: DifficultyLevelSchema,
  cognitive: CognitiveLevelSchema,
  count: BaseIntField.pipe(z.number().min(1).max(50)),
  marks: BaseNumberField,
  chapters: z.array(z.string()).min(1, "Select at least one chapter"),
  topics: z.array(z.string()).default([]),
  negativeMarking: BaseNumberField.default(0),
  requireUnits: z.boolean().default(false),
});

const SectionSchema = z.object({
  title: z.string().min(1, "Section title is required"),
  questionType: z.enum(["Multiple Choice", "Very Short Answer", "Short Answer", "Long Answer", "Case-based"]),
  count: BaseIntField.pipe(z.number().min(1)),
  marksPerQuestion: BaseNumberField,
});

const MatrixRowSchema = z.object({
  questionType: z.enum(["Multiple Choice", "Very Short Answer", "Short Answer", "Long Answer", "Case-based"]),
  marksPerQuestion: BaseNumberField,
  count: BaseIntField,
});

const FormSchema = z.object({
  // Basic Information
  board: z.enum(["CBSE", "ICSE", "State"]).default("CBSE"),
  classNum: BaseIntField.pipe(z.number().min(1).max(12)).default(10),
  subject: z.string().min(1, "Subject is required").default("Science"),

  // Content
  chapters: z.array(z.string()).min(1, "Select at least one chapter").default([]),
  topics: z.array(z.string()).default([]),

  // Generation Settings
  generationMode: z.enum(["simple", "blueprint", "matrix", "buckets"]).default("simple"),
  cognitiveLevels: z.array(CognitiveLevelSchema).min(1, "Select at least one cognitive level").default(["understand"]),
  ncertWeight: BaseNumberField.pipe(z.number().min(0).max(1)).default(0.6),
  
  // Simple Mode
  qCount: BaseIntField.pipe(z.number().min(1)).default(5),
  marksPerQuestion: BaseNumberField.default(1),

  // Blueprint Mode
  sections: z.array(SectionSchema).default([]),

  // Matrix Mode  
  markingMatrix: z.array(MatrixRowSchema).default([]),

  // Buckets Mode
  buckets: z.array(QuestionBucketSchema).default([]),

  // Presentation
  language: z.enum(["English", "Hindi"]).default("English"),
  includeAnswerKey: z.boolean().default(true),

  // Assessment
  negativeMarking: BaseNumberField.pipe(z.number().min(-10).max(0)).default(0),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
  timeLimit: z.preprocess(
    (val) => val === "" ? undefined : safeInt(val),
    z.number().min(1).optional()
  ).optional(),

  // Output
  outputFormat: z.enum(["PDF", "DOCX", "CSV", "JSON"]).default("PDF"),
  watermark: z.boolean().default(false),
  watermarkText: z.string().optional(),

  // Header
  institute: z.string().optional(),
  teacherName: z.string().optional(),
  examTitle: z.string().optional(),
  examDate: z.string().optional(),
})
.refine(
  (data) => data.generationMode !== "blueprint" || data.sections.length >= 1,
  { path: ["sections"], message: "Add at least one section for blueprint mode" }
)
.refine(
  (data) => data.generationMode !== "buckets" || data.buckets.length >= 1,
  { path: ["buckets"], message: "Add at least one question bucket" }
)
.refine(
  (data) => data.generationMode !== "buckets" || data.buckets.every(b => b.chapters.length > 0),
  { path: ["buckets"], message: "Each bucket must have at least one chapter" }
);

export type TestGeneratorFormValues = z.infer<typeof FormSchema>;

interface Props {
  onGenerate: (data: unknown) => Promise<string | null>;
  loading?: boolean;
  onSaveTemplate?: (data: TestGeneratorFormValues) => Promise<void>;
}

/* ===================== OPTIMIZED SUB-COMPONENTS ===================== */

interface ChipInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

const ChipInput: React.FC<ChipInputProps> = ({ 
  label, 
  values, 
  onChange, 
  placeholder, 
  required, 
  error 
}) => {
  const [inputValue, setInputValue] = React.useState("");

  const handleAdd = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
  }, [values, onChange]);

  const handleRemove = useCallback((itemToRemove: string) => {
    onChange(values.filter(item => item !== itemToRemove));
  }, [values, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAdd(inputValue);
      setInputValue("");
    }
  }, [inputValue, handleAdd]);

  const handleBlur = useCallback(() => {
    if (inputValue) {
      handleAdd(inputValue);
      setInputValue("");
    }
  }, [inputValue, handleAdd]);

  return (
    <div>
      <label className="block text-sm mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className={`border rounded-md p-2 min-h-[42px] ${error ? 'border-red-500' : 'border-gray-300'}`}>
        <div className="flex flex-wrap gap-1 mb-1">
          {values.map((value) => (
            <span key={value} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
              {value}
              <button 
                type="button" 
                onClick={() => handleRemove(value)} 
                className="text-blue-600 hover:text-blue-800 text-lg leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full border-0 outline-none bg-transparent"
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
};

interface CognitiveLevelSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
}

const CognitiveLevelSelector: React.FC<CognitiveLevelSelectorProps> = ({ value, onChange, error }) => {
  const levels = [
    { value: "recall", label: "🧠 Recall" },
    { value: "understand", label: "💡 Understand" },
    { value: "apply", label: "⚡ Apply" },
    { value: "analyze", label: "🔍 Analyze" },
  ] as const;

  const toggleLevel = useCallback((level: string) => {
    onChange(
      value.includes(level) 
        ? value.filter(l => l !== level)
        : [...value, level]
    );
  }, [value, onChange]);

  return (
    <div>
      <label className="block text-sm mb-2">
        Cognitive Levels <span className="text-red-500">*</span>
      </label>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {levels.map((level) => (
          <button
            key={level.value}
            type="button"
            onClick={() => toggleLevel(level.value)}
            className={`p-2 rounded border text-sm transition-colors ${
              value.includes(level.value)
                ? "bg-blue-50 border-blue-500 text-blue-700"
                : "bg-white border-gray-300 hover:bg-gray-50"
            }`}
          >
            {level.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
};

interface BucketEditorProps {
  buckets: TestGeneratorFormValues['buckets'];
  onChange: (buckets: TestGeneratorFormValues['buckets']) => void;
  error?: string;
  chapters: string[];
}

const BucketEditor: React.FC<BucketEditorProps> = ({ buckets = [], onChange, error, chapters }) => {
  const addBucket = useCallback(() => {
    onChange([
      ...buckets,
      {
        id: crypto.randomUUID(),
        type: "mcq",
        difficulty: "medium",
        cognitive: "understand",
        count: 5,
        marks: 1,
        chapters: chapters.length > 0 ? [chapters[0]] : [],
        topics: [],
        negativeMarking: 0,
        requireUnits: false,
      },
    ]);
  }, [buckets, onChange, chapters]);

  const updateBucket = useCallback((index: number, updates: Partial<TestGeneratorFormValues['buckets'][0]>) => {
    const newBuckets = [...buckets];
    newBuckets[index] = { ...newBuckets[index], ...updates };
    onChange(newBuckets);
  }, [buckets, onChange]);

  const removeBucket = useCallback((index: number) => {
    onChange(buckets.filter((_, i) => i !== index));
  }, [buckets, onChange]);

  return (
    <div className="space-y-4">
      {buckets.map((bucket, index) => (
        <div key={bucket.id} className="border rounded-lg p-4 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {[
              { key: 'type' as const, label: 'Type', options: ['mcq', 'short', 'long', 'numerical', 'case_based'] },
              { key: 'difficulty' as const, label: 'Difficulty', options: ['easy', 'medium', 'hard'] },
              { key: 'cognitive' as const, label: 'Cognitive', options: ['recall', 'understand', 'apply', 'analyze'] },
            ].map(({ key, label, options }) => (
              <div key={key} className="md:col-span-2">
                <label className="block text-xs mb-1">{label}</label>
                <select
                  value={bucket[key]}
                  onChange={(e) => updateBucket(index, { [key]: e.target.value })}
                  className="w-full border rounded px-2 py-1 text-sm"
                >
                  {options.map(opt => (
                    <option key={opt} value={opt}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            <div className="md:col-span-2">
              <label className="block text-xs mb-1">Count</label>
              <input
                type="number"
                min="1"
                max="50"
                value={bucket.count}
                onChange={(e) => updateBucket(index, { count: safeInt(e.target.value, 1) })}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs mb-1">Marks</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={bucket.marks}
                onChange={(e) => updateBucket(index, { marks: safeNumber(e.target.value, 1) })}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="button"
                onClick={() => removeBucket(index)}
                className="w-full px-2 py-1 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1">Chapters *</label>
              <input
                type="text"
                placeholder="Chapter names (comma separated)"
                value={bucket.chapters?.join(", ") || ""}
                onChange={(e) => updateBucket(index, { 
                  chapters: e.target.value.split(",").map(c => c.trim()).filter(Boolean) 
                })}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Topics</label>
              <input
                type="text"
                placeholder="Specific topics (comma separated)"
                value={bucket.topics?.join(", ") || ""}
                onChange={(e) => updateBucket(index, { 
                  topics: e.target.value.split(",").map(t => t.trim()).filter(Boolean) 
                })}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addBucket}
        className="w-full py-2 border-2 border-dashed border-gray-300 rounded text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors"
      >
        + Add Question Bucket
      </button>
      
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
};

/* ===================== MAIN FORM COMPONENT ===================== */

const TestGeneratorForm: React.FC<Props> = ({ onGenerate, loading = false }) => {
  const defaultValues: TestGeneratorFormValues = useMemo(() => ({
    board: "CBSE",
    classNum: 10,
    subject: "Science",
    chapters: [],
    topics: [],
    generationMode: "simple",
    cognitiveLevels: ["understand"],
    ncertWeight: 0.6,
    qCount: 5,
    marksPerQuestion: 1,
    sections: [],
    markingMatrix: [],
    buckets: [],
    language: "English",
    includeAnswerKey: true,
    negativeMarking: 0,
    shuffleOptions: true,
    shuffleQuestions: true,
    outputFormat: "PDF",
    watermark: false,
    watermarkText: "",
  }), []);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TestGeneratorFormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues,
  });

  // Field arrays
  const { fields: sectionFields, append: appendSection, remove: removeSection } = useFieldArray({ control, name: "sections" });
  const { fields: matrixFields, append: appendMatrix, remove: removeMatrix } = useFieldArray({ control, name: "markingMatrix" });
  
  // Watched values
  const generationMode = watch("generationMode");
  const cognitiveLevels = watch("cognitiveLevels");
  const chapters = watch("chapters");
  const buckets = watch("buckets");
  const qCount = watch("qCount");
  const sections = watch("sections");
  const matrixRows = watch("markingMatrix");
  const marksPerQuestion = watch("marksPerQuestion");
  const ncertWeight = watch("ncertWeight");

  // Optimized calculations
  const { totalMarks, totalQuestions } = useMemo(() => {
    let marks = 0;
    let questions = 0;

    switch (generationMode) {
      case "blueprint":
        marks = sections.reduce((sum, s) => sum + (s.count * s.marksPerQuestion), 0);
        questions = sections.reduce((sum, s) => sum + s.count, 0);
        break;
      case "matrix":
        marks = matrixRows.reduce((sum, r) => sum + (r.count * r.marksPerQuestion), 0);
        questions = matrixRows.reduce((sum, r) => sum + r.count, 0);
        break;
      case "buckets":
        marks = buckets.reduce((sum, b) => sum + (b.count * b.marks), 0);
        questions = buckets.reduce((sum, b) => sum + b.count, 0);
        break;
      default:
        marks = qCount * marksPerQuestion;
        questions = qCount;
    }

    return { totalMarks: marks, totalQuestions: questions };
  }, [generationMode, qCount, marksPerQuestion, sections, matrixRows, buckets]);

  // Optimized submit handler
  const onSubmit = useCallback(async (data: TestGeneratorFormValues) => {
    try {
      // Convert numeric fields to strings for backend compatibility
      const backendData = {
        ...data,
        classNum: data.classNum.toString(),
        qCount: data.qCount.toString(),
        marksPerQuestion: data.marksPerQuestion.toString(),
        ncertWeight: data.ncertWeight.toString(),
        negativeMarking: data.negativeMarking.toString(),
        timeLimit: data.timeLimit?.toString() || undefined,
        
        sections: data.sections.map(section => ({
          ...section,
          count: section.count.toString(),
          marksPerQuestion: section.marksPerQuestion.toString(),
        })),
        
        markingMatrix: data.markingMatrix.map(row => ({
          ...row,
          count: row.count.toString(),
          marksPerQuestion: row.marksPerQuestion.toString(),
        })),
        
        buckets: data.buckets.map(bucket => ({
          ...bucket,
          count: bucket.count.toString(),
          marks: bucket.marks.toString(),
          negativeMarking: bucket.negativeMarking.toString(),
        })),
      };

      console.log("Submitting data to backend:", backendData);
      await onGenerate(backendData);
      
    } catch (error) {
      console.error("Form submission error:", error);
    }
  }, [onGenerate]);

  // Presets
  const applyCBSE80Preset = useCallback(() => {
    setValue("generationMode", "matrix");
    setValue("markingMatrix", [
      { questionType: "Multiple Choice", marksPerQuestion: 1, count: 20 },
      { questionType: "Very Short Answer", marksPerQuestion: 2, count: 6 },
      { questionType: "Short Answer", marksPerQuestion: 3, count: 7 },
      { questionType: "Long Answer", marksPerQuestion: 4, count: 3 },
    ]);
  }, [setValue]);

  const applyCognitiveBalancedPreset = useCallback(() => {
    const currentChapters = chapters.length > 0 ? chapters : ["General Topics"];
    setValue("generationMode", "buckets");
    setValue("buckets", [
      {
        id: crypto.randomUUID(),
        type: "mcq",
        difficulty: "easy",
        cognitive: "recall",
        count: 5,
        marks: 1,
        chapters: currentChapters,
        topics: [],
        negativeMarking: 0.25,
        requireUnits: false,
      },
      {
        id: crypto.randomUUID(),
        type: "short",
        difficulty: "medium", 
        cognitive: "understand",
        count: 8,
        marks: 2,
        chapters: currentChapters,
        topics: [],
        negativeMarking: 0,
        requireUnits: true,
      }
    ]);
  }, [setValue, chapters]);

  const errorText = (error?: { message?: string }) => 
    error?.message && <p className="text-xs text-red-600 mt-1">{error.message}</p>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Create Enhanced Test</h3>
        <div className="flex gap-2">
          <button type="button" onClick={applyCBSE80Preset} className="px-3 py-2 border rounded text-sm hover:bg-gray-50 transition-colors">
            CBSE 80 Preset
          </button>
          <button type="button" onClick={applyCognitiveBalancedPreset} className="px-3 py-2 border rounded text-sm hover:bg-gray-50 transition-colors">
            Cognitive Balanced
          </button>
        </div>
      </div>

      {/* Basic Information */}
      <div className="border rounded-lg bg-white">
        <div className="px-4 py-3 border-b font-medium">Basic Information</div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Board</label>
            <select {...register("board")} className="w-full border rounded px-3 py-2">
              <option value="CBSE">CBSE</option>
              <option value="ICSE">ICSE</option>
              <option value="State">State</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Class *</label>
            <input
              type="number"
              {...register("classNum", { valueAsNumber: true })}
              min="1"
              max="12"
              className="w-full border rounded px-3 py-2"
            />
            {errorText(errors.classNum)}
          </div>

          <div>
            <label className="block text-sm mb-1">Subject *</label>
            <input
              {...register("subject")}
              className="w-full border rounded px-3 py-2"
              placeholder="e.g., Science, Mathematics"
            />
            {errorText(errors.subject)}
          </div>

          <div>
            <label className="block text-sm mb-1">Language</label>
            <select {...register("language")} className="w-full border rounded px-3 py-2">
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
            </select>
          </div>

          <Controller
            control={control}
            name="chapters"
            render={({ field, fieldState }) => (
              <ChipInput
                label="Chapters *"
                values={field.value}
                onChange={field.onChange}
                placeholder="e.g., Electricity, Magnetism"
                required
                error={fieldState.error?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="topics"
            render={({ field }) => (
              <ChipInput
                label="Topics"
                values={field.value}
                onChange={field.onChange}
                placeholder="e.g., Ohm's Law, Reflection"
              />
            )}
          />
        </div>
      </div>

      {/* Cognitive Settings */}
      <div className="border rounded-lg bg-white">
        <div className="px-4 py-3 border-b font-medium">Cognitive Settings</div>
        <div className="p-4 space-y-4">
          <Controller
            control={control}
            name="cognitiveLevels"
            render={({ field, fieldState }) => (
              <CognitiveLevelSelector 
                value={field.value} 
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />

          <div>
            <label className="block text-sm mb-2">
              NCERT Alignment: {Math.round(ncertWeight * 100)}%
            </label>
            <input
              type="range"
              {...register("ncertWeight", { valueAsNumber: true })}
              className="w-full"
              min="0"
              max="1"
              step="0.1"
            />
          </div>
        </div>
      </div>

      {/* Question Pattern */}
      <div className="border rounded-lg bg-white">
        <div className="px-4 py-3 border-b font-medium">Question Pattern</div>
        <div className="p-4 space-y-6">
          <div>
            <label className="block text-sm mb-2">Generation Mode</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {["simple", "blueprint", "matrix", "buckets"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setValue("generationMode", mode as any)}
                  className={`p-3 rounded border text-left transition-colors ${
                    generationMode === mode ? "bg-blue-50 border-blue-500" : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="font-medium text-sm capitalize">{mode}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Simple Mode */}
          {generationMode === "simple" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1"># Questions *</label>
                <input
                  type="number"
                  {...register("qCount", { valueAsNumber: true })}
                  min="1"
                  className="w-full border rounded px-3 py-2"
                />
                {errorText(errors.qCount)}
              </div>
              <div>
                <label className="block text-sm mb-1">Marks per Question *</label>
                <input
                  type="number"
                  {...register("marksPerQuestion", { valueAsNumber: true })}
                  min="0"
                  step="0.5"
                  className="w-full border rounded px-3 py-2"
                />
                {errorText(errors.marksPerQuestion)}
              </div>
            </div>
          )}

          {/* Buckets Mode */}
          {generationMode === "buckets" && (
            <div>
              <Controller
                control={control}
                name="buckets"
                render={({ field, fieldState }) => (
                  <BucketEditor 
                    buckets={field.value} 
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                    chapters={chapters}
                  />
                )}
              />
            </div>
          )}
        </div>
      </div>

      {/* Summary & Submit */}
      <div className="border rounded-lg bg-gray-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium">
              {totalQuestions} questions · Total marks: {totalMarks}
            </div>
            <div className="text-sm text-gray-600">
              Cognitive levels: {cognitiveLevels.join(", ")} · NCERT: {Math.round(ncertWeight * 100)}%
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading || isSubmitting ? "Generating..." : "Generate Test"}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {Object.keys(errors).length > 0 && (
        <div className="border border-red-200 bg-red-50 p-4 rounded">
          <div className="text-red-800 font-medium mb-2">Please fix the following errors:</div>
          <ul className="text-red-700 text-sm list-disc list-inside space-y-1">
            {Object.entries(errors).map(([key, error]: any) => (
              <li key={key}>{error.message || `Invalid ${key}`}</li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
};

export default TestGeneratorForm;