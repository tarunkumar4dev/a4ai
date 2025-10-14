// src/components/TestGeneratorForm.tsx - ENHANCED VERSION
import React, { useMemo } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

/* ===================== Enhanced Types & Schema ===================== */

const CognitiveLevelSchema = z.enum(["recall", "understand", "apply", "analyze"]);
const QuestionTypeSchema = z.enum(["mcq", "short", "long", "numerical", "case_based"]);
const DifficultyLevelSchema = z.enum(["easy", "medium", "hard"]);

const QuestionBucketSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substr(2, 9)),
  type: QuestionTypeSchema,
  difficulty: DifficultyLevelSchema,
  cognitive: CognitiveLevelSchema,
  count: z.number().int().min(1).max(50),
  marks: z.number().min(0),
  chapters: z.array(z.string()).min(1),
  topics: z.array(z.string()).default([]),
  negativeMarking: z.number().min(0).default(0),
  requireUnits: z.boolean().default(false),
});

const SectionSchema = z.object({
  title: z.string().min(1, "Required"),
  questionType: z.enum(["Multiple Choice", "Very Short Answer", "Short Answer", "Long Answer", "Case-based"]),
  count: z.number().int().min(1, ">= 1"),
  marksPerQuestion: z.number().min(0, ">= 0"),
});

const MatrixRowSchema = z.object({
  questionType: z.enum(["Multiple Choice", "Very Short Answer", "Short Answer", "Long Answer", "Case-based"]),
  marksPerQuestion: z.number().min(0),
  count: z.number().int().min(0),
});

const FormSchema = z.object({
  // Basic Information
  board: z.enum(["CBSE", "ICSE", "State"], { required_error: "Select board" }),
  classNum: z.number().int().min(1).max(12),
  subject: z.string().min(1, "Enter subject"),

  // Enhanced Content Specification
  chapters: z.array(z.string()).min(1, "Select at least one chapter"),
  topics: z.array(z.string()).default([]),
  subtopics: z.array(z.string()).default([]),

  // Enhanced Generation Mode
  generationMode: z.enum(["simple", "blueprint", "matrix", "buckets"]).default("simple"),
  
  // Cognitive Levels
  cognitiveLevels: z.array(CognitiveLevelSchema).min(1, "Select at least one cognitive level"),
  
  // NCERT Alignment
  ncertWeight: z.number().min(0).max(1).default(0.6),
  requireUnits: z.boolean().default(true),
  
  // Duplicate Prevention
  avoidDuplicates: z.boolean().default(true),

  // Legacy fields for backward compatibility
  questionType: z.enum(["Multiple Choice", "Short Answer", "Long Answer", "Mixed"]).default("Multiple Choice"),
  mode: z.enum(["single", "mix"]).default("single"),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).default("Easy"),
  mix: z.object({
    easy: z.number().min(0).max(100).default(40),
    medium: z.number().min(0).max(100).default(40),
    hard: z.number().min(0).max(100).default(20),
  }).default({ easy: 40, medium: 40, hard: 20 }),

  // SIMPLE pattern
  qCount: z.number().int().min(1, ">= 1").default(5),
  marksPerQuestion: z.number().min(0).default(1),

  // BLUEPRINT pattern
  sections: z.array(SectionSchema).default([]),

  // MATRIX pattern
  markingMatrix: z.array(MatrixRowSchema).default([]),

  // BUCKETS pattern (Enhanced)
  buckets: z.array(QuestionBucketSchema).default([]),

  // Presentation
  language: z.enum(["English", "Hindi"]).default("English"),
  solutionStyle: z.enum(["Steps", "Concise"]).default("Steps"),
  includeAnswerKey: z.boolean().default(true),

  // Assessment Settings
  negativeMarking: z.number().min(-10).max(0).default(0),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
  timeLimit: z.number().min(5).optional(),

  // Additional Content
  notes: z.string().max(2000).optional(),

  // Output Settings
  outputFormat: z.enum(["PDF", "DOCX", "CSV", "JSON"]).default("PDF"),
  watermark: z.boolean().default(false),
  watermarkText: z.string().optional(),
  useLogo: z.boolean().default(true),
  shareable: z.boolean().default(false),

  // File inputs
  referenceFiles: z.instanceof(File).array().optional(),

  // Header Information
  institute: z.string().optional(),
  teacherName: z.string().optional(),
  examTitle: z.string().optional(),
  examDate: z.string().optional(),
})
.refine((data) => {
  if (data.mode === "mix") {
    const sum = (data.mix.easy || 0) + (data.mix.medium || 0) + (data.mix.hard || 0);
    return sum === 100;
  }
  return true;
}, { path: ["mix"], message: "Mix must sum to 100%" })
.refine((d) => (d.generationMode === "blueprint" ? d.sections.length >= 1 : true), {
  path: ["sections"],
  message: "Add at least one section",
})
.refine((d) => (d.generationMode === "buckets" ? d.buckets.length >= 1 : true), {
  path: ["buckets"],
  message: "Add at least one question bucket",
});

export type TestGeneratorFormValues = z.infer<typeof FormSchema>;

type Props = {
  /** Must return a downloadable URL or null */
  onGenerate: (data: TestGeneratorFormValues) => Promise<string | null>;
  loading?: boolean;
  onSaveTemplate?: (data: TestGeneratorFormValues) => Promise<void>;
};

/* ===================== Enhanced Input Components ===================== */

function ChipInput({
  label,
  values,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [text, setText] = React.useState("");
  const add = () => {
    const v = text.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setText("");
  };
  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && !text && values.length) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div>
      <label className="block text-sm mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="w-full border rounded-md px-2 py-2 bg-white">
        <div className="flex flex-wrap gap-2 mb-2">
          {values.map((t, i) => (
            <span
              key={`${t}-${i}`}
              className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs bg-slate-100 border"
            >
              {t}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== t))}
                className="text-slate-500 hover:text-black"
                aria-label={`Remove ${t}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          className="w-full outline-none px-1"
          placeholder={placeholder || "Type and press Enter"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label={`${label} input`}
        />
      </div>
    </div>
  );
}

function CognitiveLevelSelector({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const levels = [
    { value: "recall", label: "🧠 Recall", description: "Remember facts and concepts" },
    { value: "understand", label: "💡 Understand", description: "Explain ideas and concepts" },
    { value: "apply", label: "⚡ Apply", description: "Use knowledge in new situations" },
    { value: "analyze", label: "🔍 Analyze", description: "Draw connections among ideas" },
  ];

  const toggleLevel = (level: string) => {
    if (value.includes(level)) {
      onChange(value.filter(l => l !== level));
    } else {
      onChange([...value, level]);
    }
  };

  return (
    <div>
      <label className="block text-sm mb-2">Cognitive Levels <span className="text-red-500">*</span></label>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {levels.map((level) => (
          <button
            key={level.value}
            type="button"
            onClick={() => toggleLevel(level.value)}
            className={`p-3 rounded-lg border text-left transition-all ${
              value.includes(level.value)
                ? "bg-blue-50 border-blue-500 text-blue-700"
                : "bg-white border-gray-300 hover:bg-gray-50"
            }`}
          >
            <div className="font-medium text-sm">{level.label}</div>
            <div className="text-xs text-gray-600 mt-1">{level.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function BucketEditor({ buckets, onChange }: { buckets: any[]; onChange: (buckets: any[]) => void }) {
  const addBucket = () => {
    onChange([
      ...buckets,
      {
        id: Math.random().toString(36).substr(2, 9),
        type: "mcq",
        difficulty: "medium",
        cognitive: "understand",
        count: 5,
        marks: 1,
        chapters: [],
        topics: [],
        negativeMarking: 0,
        requireUnits: false,
      },
    ]);
  };

  const updateBucket = (index: number, updates: any) => {
    const newBuckets = [...buckets];
    newBuckets[index] = { ...newBuckets[index], ...updates };
    onChange(newBuckets);
  };

  const removeBucket = (index: number) => {
    onChange(buckets.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {buckets.map((bucket, index) => (
        <div key={bucket.id} className="border rounded-lg p-4 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Question Type */}
            <div className="md:col-span-2">
              <label className="block text-xs mb-1">Type</label>
              <select
                value={bucket.type}
                onChange={(e) => updateBucket(index, { type: e.target.value })}
                className="w-full border rounded-md px-2 py-2 text-sm"
              >
                <option value="mcq">MCQ</option>
                <option value="short">Short Answer</option>
                <option value="long">Long Answer</option>
                <option value="numerical">Numerical</option>
                <option value="case_based">Case Based</option>
              </select>
            </div>

            {/* Difficulty */}
            <div className="md:col-span-2">
              <label className="block text-xs mb-1">Difficulty</label>
              <select
                value={bucket.difficulty}
                onChange={(e) => updateBucket(index, { difficulty: e.target.value })}
                className="w-full border rounded-md px-2 py-2 text-sm"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            {/* Cognitive Level */}
            <div className="md:col-span-2">
              <label className="block text-xs mb-1">Cognitive</label>
              <select
                value={bucket.cognitive}
                onChange={(e) => updateBucket(index, { cognitive: e.target.value })}
                className="w-full border rounded-md px-2 py-2 text-sm"
              >
                <option value="recall">Recall</option>
                <option value="understand">Understand</option>
                <option value="apply">Apply</option>
                <option value="analyze">Analyze</option>
              </select>
            </div>

            {/* Count */}
            <div className="md:col-span-1">
              <label className="block text-xs mb-1">Count</label>
              <input
                type="number"
                min="1"
                max="50"
                value={bucket.count}
                onChange={(e) => updateBucket(index, { count: parseInt(e.target.value) })}
                className="w-full border rounded-md px-2 py-2 text-sm"
              />
            </div>

            {/* Marks */}
            <div className="md:col-span-1">
              <label className="block text-xs mb-1">Marks</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={bucket.marks}
                onChange={(e) => updateBucket(index, { marks: parseFloat(e.target.value) })}
                className="w-full border rounded-md px-2 py-2 text-sm"
              />
            </div>

            {/* Negative Marking */}
            <div className="md:col-span-2">
              <label className="block text-xs mb-1">Negative Marking</label>
              <input
                type="number"
                min="0"
                step="0.25"
                value={bucket.negativeMarking}
                onChange={(e) => updateBucket(index, { negativeMarking: parseFloat(e.target.value) })}
                className="w-full border rounded-md px-2 py-2 text-sm"
              />
            </div>

            {/* Remove Button */}
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={() => removeBucket(index)}
                className="w-full px-3 py-2 text-sm border border-red-300 text-red-600 rounded-md hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          </div>

          {/* Chapters and Topics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs mb-1">Chapters</label>
              <input
                type="text"
                placeholder="Chapter names (comma separated)"
                value={bucket.chapters.join(", ")}
                onChange={(e) => updateBucket(index, { chapters: e.target.value.split(",").map(c => c.trim()).filter(Boolean) })}
                className="w-full border rounded-md px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Topics</label>
              <input
                type="text"
                placeholder="Specific topics (comma separated)"
                value={bucket.topics.join(", ")}
                onChange={(e) => updateBucket(index, { topics: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })}
                className="w-full border rounded-md px-2 py-2 text-sm"
              />
            </div>
          </div>

          {/* Units Requirement */}
          <div className="mt-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bucket.requireUnits}
                onChange={(e) => updateBucket(index, { requireUnits: e.target.checked })}
                className="rounded"
              />
              Require units in answers
            </label>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addBucket}
        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors"
      >
        + Add Question Bucket
      </button>
    </div>
  );
}

/* ===================== Main Form Component ===================== */

const TestGeneratorForm: React.FC<Props> = ({ onGenerate, loading, onSaveTemplate }) => {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TestGeneratorFormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      board: "CBSE",
      classNum: 10,
      subject: "",
      chapters: [],
      topics: [],
      subtopics: [],
      generationMode: "simple",
      cognitiveLevels: ["understand", "apply"],
      ncertWeight: 0.6,
      requireUnits: true,
      avoidDuplicates: true,
      questionType: "Multiple Choice",
      mode: "single",
      difficulty: "Easy",
      mix: { easy: 50, medium: 30, hard: 20 },
      qCount: 5,
      marksPerQuestion: 1,
      sections: [],
      markingMatrix: [],
      buckets: [],
      language: "English",
      solutionStyle: "Steps",
      includeAnswerKey: true,
      negativeMarking: 0,
      shuffleOptions: true,
      shuffleQuestions: true,
      outputFormat: "PDF",
      watermark: false,
      watermarkText: "",
      useLogo: true,
      shareable: false,
      referenceFiles: [],
      notes: "",
    },
  });

  // Field arrays
  const { fields: sectionFields, append: appendSection, remove: removeSection } = useFieldArray({ control, name: "sections" });
  const { fields: matrixFields, append: appendMatrix, remove: removeMatrix } = useFieldArray({ control, name: "markingMatrix" });
  
  // Watched values
  const generationMode = watch("generationMode");
  const cognitiveLevels = watch("cognitiveLevels");
  const chapters = watch("chapters");
  const buckets = watch("buckets");
  const mode = watch("mode");
  const mix = watch("mix");
  const qCount = watch("qCount");
  const sections = watch("sections");
  const matrixRows = watch("markingMatrix");
  const marksPerQuestion = watch("marksPerQuestion");
  const ncertWeight = watch("ncertWeight");

  // Calculations
  const totalMarks = useMemo(() => {
    if (generationMode === "blueprint") {
      return sections.reduce((sum, s) => sum + s.count * s.marksPerQuestion, 0);
    }
    if (generationMode === "matrix") {
      return (matrixRows || []).reduce((sum, r) => sum + (r.count || 0) * (r.marksPerQuestion || 0), 0);
    }
    if (generationMode === "buckets") {
      return buckets.reduce((sum, b) => sum + (b.count || 0) * (b.marks || 0), 0);
    }
    return (qCount || 0) * (marksPerQuestion || 0);
  }, [generationMode, qCount, marksPerQuestion, sections, matrixRows, buckets]);

  const totalQuestions = useMemo(() => {
    if (generationMode === "blueprint") return sections.reduce((s, x) => s + (x.count || 0), 0);
    if (generationMode === "matrix") return (matrixRows || []).reduce((s, x) => s + (x.count || 0), 0);
    if (generationMode === "buckets") return buckets.reduce((s, b) => s + (b.count || 0), 0);
    return qCount || 0;
  }, [generationMode, qCount, sections, matrixRows, buckets]);

  const onSubmit = async (data: TestGeneratorFormValues) => {
    await onGenerate(data);
  };

  const errorText = (e?: any) => e && <p className="text-xs text-red-600 mt-1">{e.message?.toString()}</p>;

  // Presets
  const applyCBSE80Preset = () => {
    setValue("generationMode", "matrix");
    setValue("markingMatrix", [
      { questionType: "Multiple Choice", marksPerQuestion: 1, count: 20 },
      { questionType: "Very Short Answer", marksPerQuestion: 2, count: 6 },
      { questionType: "Short Answer", marksPerQuestion: 3, count: 7 },
      { questionType: "Long Answer", marksPerQuestion: 4, count: 3 },
    ]);
  };

  const applyCognitiveBalancedPreset = () => {
    setValue("generationMode", "buckets");
    setValue("buckets", [
      {
        id: "1",
        type: "mcq",
        difficulty: "easy",
        cognitive: "recall",
        count: 5,
        marks: 1,
        chapters: chapters,
        topics: [],
        negativeMarking: 0.25,
        requireUnits: false,
      },
      {
        id: "2", 
        type: "short",
        difficulty: "medium",
        cognitive: "understand",
        count: 8,
        marks: 2,
        chapters: chapters,
        topics: [],
        negativeMarking: 0,
        requireUnits: true,
      },
      {
        id: "3",
        type: "long", 
        difficulty: "hard",
        cognitive: "apply",
        count: 4,
        marks: 4,
        chapters: chapters,
        topics: [],
        negativeMarking: 0,
        requireUnits: true,
      },
      {
        id: "4",
        type: "numerical",
        difficulty: "hard", 
        cognitive: "analyze",
        count: 3,
        marks: 5,
        chapters: chapters,
        topics: [],
        negativeMarking: 0,
        requireUnits: true,
      },
    ]);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" aria-label="Enhanced Test Generator Form">
      {/* ======= Header actions ======= */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Create Enhanced Test</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={applyCBSE80Preset}
            className="px-3 py-2 rounded-md border hover:bg-slate-100 text-sm"
            title="Apply CBSE 80-marks matrix"
          >
            CBSE 80 Preset
          </button>
          <button
            type="button"
            onClick={applyCognitiveBalancedPreset}
            className="px-3 py-2 rounded-md border hover:bg-slate-100 text-sm"
            title="Apply cognitive-balanced bucket preset"
          >
            Cognitive Balanced
          </button>
          {onSaveTemplate && (
            <button
              type="button"
              onClick={handleSubmit((d) => onSaveTemplate?.(d))}
              className="px-3 py-2 rounded-md border hover:bg-slate-100 text-sm"
              title="Save the current configuration as a reusable template"
            >
              Save as Template
            </button>
          )}
        </div>
      </div>

      {/* ======== Basic Information ======== */}
      <div className="rounded-lg border bg-white">
        <div className="px-4 py-3 border-b font-medium">Basic Information</div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm mb-1">Board</label>
            <select className="w-full border rounded-md px-3 py-2 bg-white" {...register("board")}>
              <option>CBSE</option>
              <option>ICSE</option>
              <option>State</option>
            </select>
            {errorText(errors.board)}
          </div>

          <div>
            <label className="block text-sm mb-1">Class</label>
            <input
              type="number"
              min={1}
              max={12}
              className="w-full border rounded-md px-3 py-2"
              {...register("classNum", { valueAsNumber: true })}
            />
            {errorText(errors.classNum)}
          </div>

          <div>
            <label className="block text-sm mb-1">Subject</label>
            <input
              className="w-full border rounded-md px-3 py-2"
              placeholder="Maths / Science / ..."
              {...register("subject")}
            />
            {errorText(errors.subject)}
          </div>

          <div>
            <label className="block text-sm mb-1">Language</label>
            <select className="w-full border rounded-md px-3 py-2 bg-white" {...register("language")}>
              <option>English</option>
              <option>Hindi</option>
            </select>
          </div>

          {/* Enhanced Chapters Input */}
          <Controller
            control={control}
            name="chapters"
            render={({ field }) => (
              <ChipInput
                label="Chapters"
                values={field.value}
                onChange={(v) => field.onChange(v)}
                placeholder="e.g., Electricity, Magnetism, Optics"
                required
              />
            )}
          />

          {/* Topics/Subtopics chips */}
          <Controller
            control={control}
            name="topics"
            render={({ field }) => (
              <ChipInput
                label="Topics"
                values={field.value}
                onChange={(v) => field.onChange(v)}
                placeholder="e.g., Ohm's Law, Reflection, Refraction"
              />
            )}
          />
          <Controller
            control={control}
            name="subtopics"
            render={({ field }) => (
              <ChipInput
                label="Subtopics"
                values={field.value}
                onChange={(v) => field.onChange(v)}
                placeholder="e.g., Series Circuits, Lens Formula"
              />
            )}
          />

          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Description / Keywords</label>
            <textarea
              rows={3}
              className="w-full border rounded-md px-3 py-2"
              placeholder="Syllabus scope, NCERT chapter numbers, constraints, etc."
              {...register("notes")}
            />
          </div>
        </div>
      </div>

      {/* ======== Enhanced Cognitive Settings ======== */}
      <div className="rounded-lg border bg-white">
        <div className="px-4 py-3 border-b font-medium">Cognitive & Curriculum Settings</div>
        <div className="p-4 space-y-6">
          {/* Cognitive Levels */}
          <Controller
            control={control}
            name="cognitiveLevels"
            render={({ field }) => (
              <CognitiveLevelSelector value={field.value} onChange={field.onChange} />
            )}
          />
          {errorText(errors.cognitiveLevels)}

          {/* NCERT Weight */}
          <div>
            <label className="block text-sm mb-2">
              NCERT Alignment: {Math.round(ncertWeight * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              className="w-full"
              {...register("ncertWeight", { valueAsNumber: true })}
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>Low NCERT Focus</span>
              <span>High NCERT Focus</span>
            </div>
          </div>

          {/* Additional Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register("requireUnits")} />
              <span>Require units in answers</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register("avoidDuplicates")} />
              <span>Avoid duplicate questions</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register("shareable")} />
              <span>Make shareable</span>
            </label>
          </div>
        </div>
      </div>

      {/* ======== Generation Pattern ======== */}
      <div className="rounded-lg border bg-white">
        <div className="px-4 py-3 border-b font-medium">Question Pattern & Distribution</div>
        <div className="p-4 space-y-6">
          {/* Generation Mode Selection */}
          <div>
            <label className="block text-sm mb-2">Generation Mode</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { value: "simple", label: "📝 Simple", description: "Basic count and marks" },
                { value: "blueprint", label: "📊 Blueprint", description: "Section-wise distribution" },
                { value: "matrix", label: "🔢 Matrix", description: "Type-wise marking scheme" },
                { value: "buckets", label: "🎯 Buckets", description: "Advanced cognitive buckets" },
              ].map((modeOption) => (
                <button
                  key={modeOption.value}
                  type="button"
                  onClick={() => setValue("generationMode", modeOption.value as any)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    generationMode === modeOption.value
                      ? "bg-blue-50 border-blue-500 text-blue-700"
                      : "bg-white border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="font-medium text-sm">{modeOption.label}</div>
                  <div className="text-xs text-gray-600 mt-1">{modeOption.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* SIMPLE MODE */}
          {generationMode === "simple" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm mb-1"># Questions</label>
                <input
                  type="number"
                  min={1}
                  className="w-full border rounded-md px-3 py-2"
                  {...register("qCount", { valueAsNumber: true })}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Marks per Question</label>
                <input
                  type="number"
                  min={0}
                  className="w-full border rounded-md px-3 py-2"
                  {...register("marksPerQuestion", { valueAsNumber: true })}
                />
              </div>
            </div>
          )}

          {/* BLUEPRINT MODE */}
          {generationMode === "blueprint" && (
            <div className="rounded-md border p-4 space-y-4">
              {sectionFields.map((field, idx) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-3">
                    <label className="block text-xs mb-1">Title</label>
                    <input
                      className="w-full border rounded-md px-2 py-2"
                      {...register(`sections.${idx}.title` as const)}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs mb-1">Type</label>
                    <select
                      className="w-full border rounded-md px-2 py-2 bg-white"
                      {...register(`sections.${idx}.questionType` as const)}
                    >
                      <option>Multiple Choice</option>
                      <option>Very Short Answer</option>
                      <option>Short Answer</option>
                      <option>Long Answer</option>
                      <option>Case-based</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs mb-1">Count</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full border rounded-md px-2 py-2"
                      {...register(`sections.${idx}.count` as const, { valueAsNumber: true })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs mb-1">Marks/Q</label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded-md px-2 py-2"
                      {...register(`sections.${idx}.marksPerQuestion` as const, { valueAsNumber: true })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="button"
                      onClick={() => removeSection(idx)}
                      className="w-full px-3 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {errors.sections && <p className="text-xs text-red-600">{errors.sections.message?.toString()}</p>}
              <button
                type="button"
                onClick={() =>
                  appendSection({
                    title: sectionFields.length ? `Section ${String.fromCharCode(65 + sectionFields.length)}` : "Section A",
                    questionType: "Multiple Choice",
                    count: 5,
                    marksPerQuestion: 1,
                  })
                }
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                + Add Section
              </button>
            </div>
          )}

          {/* MATRIX MODE */}
          {generationMode === "matrix" && (
            <div className="rounded-md border p-4 space-y-4">
              {matrixFields.map((field, idx) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-4">
                    <label className="block text-xs mb-1">Question Type</label>
                    <select
                      className="w-full border rounded-md px-2 py-2 bg-white"
                      {...register(`markingMatrix.${idx}.questionType` as const)}
                    >
                      <option>Multiple Choice</option>
                      <option>Very Short Answer</option>
                      <option>Short Answer</option>
                      <option>Long Answer</option>
                      <option>Case-based</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs mb-1">Marks/Q</label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded-md px-2 py-2"
                      {...register(`markingMatrix.${idx}.marksPerQuestion` as const, { valueAsNumber: true })}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs mb-1">Count</label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded-md px-2 py-2"
                      {...register(`markingMatrix.${idx}.count` as const, { valueAsNumber: true })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="button"
                      onClick={() => removeMatrix(idx)}
                      className="w-full px-3 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => appendMatrix({ questionType: "Multiple Choice", marksPerQuestion: 1, count: 0 })}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                + Add Row
              </button>
            </div>
          )}

          {/* BUCKETS MODE - Enhanced */}
          {generationMode === "buckets" && (
            <div className="rounded-md border p-4">
              <Controller
                control={control}
                name="buckets"
                render={({ field }) => (
                  <BucketEditor buckets={field.value} onChange={field.onChange} />
                )}
              />
              {errors.buckets && <p className="text-xs text-red-600 mt-2">{errors.buckets.message?.toString()}</p>}
            </div>
          )}

          {/* Difficulty Settings (for simple mode) */}
          {generationMode === "simple" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm mb-1">Difficulty Mode</label>
                <div className="flex gap-3">
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" value="single" {...register("mode")} />
                    <span>Single</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" value="mix" {...register("mode")} />
                    <span>Percent mix</span>
                  </label>
                </div>

                {mode === "single" ? (
                  <select className="mt-2 w-full border rounded-md px-3 py-2 bg-white" {...register("difficulty")}>
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </select>
                ) : (
                  <div className="mt-2 grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs mb-1">Easy %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="w-full border rounded-md px-2 py-2"
                        {...register("mix.easy", { valueAsNumber: true })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Medium %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="w-full border rounded-md px-2 py-2"
                        {...register("mix.medium", { valueAsNumber: true })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Hard %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="w-full border rounded-md px-2 py-2"
                        {...register("mix.hard", { valueAsNumber: true })}
                      />
                    </div>
                    <div className="col-span-3 text-xs text-slate-600">
                      Sum: {(mix.easy ?? 0) + (mix.medium ?? 0) + (mix.hard ?? 0)}%
                      {errors.mix && <span className="ml-2 text-red-600">{errors.mix.message?.toString()}</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======== Advanced Settings ======== */}
      <details className="rounded-lg border bg-white open:shadow-sm">
        <summary className="cursor-pointer list-none px-4 py-3 font-medium">
          Advanced Settings & Output Options
        </summary>

        <div className="px-4 pb-4 pt-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Time Limit (minutes)</label>
                <input
                  type="number"
                  min="5"
                  className="w-full border rounded-md px-3 py-2"
                  {...register("timeLimit", { valueAsNumber: true })}
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Negative Marking (per wrong)</label>
                <input
                  type="number"
                  step="0.25"
                  min={-10}
                  max={0}
                  className="w-full border rounded-md px-3 py-2"
                  {...register("negativeMarking", { valueAsNumber: true })}
                />
                <p className="text-xs text-slate-500 mt-1">Use 0 for none, e.g., -0.25</p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-3">
                  <input id="shuffleQ" type="checkbox" {...register("shuffleQuestions")} />
                  <label htmlFor="shuffleQ">Shuffle questions</label>
                </label>
                <label className="flex items-center gap-3">
                  <input id="shuffleOpt" type="checkbox" {...register("shuffleOptions")} />
                  <label htmlFor="shuffleOpt">Shuffle MCQ options</label>
                </label>
                <label className="flex items-center gap-3">
                  <input id="answerKey" type="checkbox" {...register("includeAnswerKey")} />
                  <label htmlFor="answerKey">Include answer key</label>
                </label>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Solution Style</label>
                <select className="w-full border rounded-md px-3 py-2 bg-white" {...register("solutionStyle")}>
                  <option>Steps</option>
                  <option>Concise</option>
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">Output Format</label>
                <select className="w-full border rounded-md px-3 py-2 bg-white" {...register("outputFormat")}>
                  <option>PDF</option>
                  <option>DOCX</option>
                  <option>CSV</option>
                  <option>JSON</option>
                </select>
              </div>

              {/* Header Information */}
              <div className="space-y-2">
                <input
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="Institute Name (optional)"
                  {...register("institute")}
                />
                <input
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="Teacher Name (optional)"
                  {...register("teacherName")}
                />
                <input
                  className="w-full border rounded-md px-3 py-2"
                  placeholder="Exam Title (optional)"
                  {...register("examTitle")}
                />
                <input
                  className="w-full border rounded-md px-3 py-2"
                  type="date"
                  {...register("examDate")}
                />
              </div>
            </div>
          </div>

          {/* References */}
          <div>
            <label className="block text-sm mb-1">Reference files</label>
            <Controller
              control={control}
              name="referenceFiles"
              render={({ field }) => (
                <input
                  type="file"
                  multiple
                  accept=".txt,.csv,.md,.pdf,.doc,.docx"
                  className="w-full border rounded-md px-3 py-2"
                  onChange={(e) => field.onChange(Array.from(e.target.files || []))}
                />
              )}
            />
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-medium">Note:</span> txt/csv/md are parsed directly; pdf/doc/docx extraction can be added.
            </p>
          </div>

          {/* Watermark */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <input id="wm" type="checkbox" {...register("watermark")} />
              <label htmlFor="wm">Watermark</label>
            </div>
            <div className="md:col-span-2">
              <input
                className="w-full border rounded-md px-3 py-2"
                placeholder="Watermark text (optional)"
                {...register("watermarkText")}
              />
              <div className="flex items-center gap-3 mt-2">
                <input id="logo" type="checkbox" {...register("useLogo")} />
                <label htmlFor="logo">Include a4ai logo</label>
              </div>
            </div>
          </div>
        </div>
      </details>

      {/* ======== Summary & Generate Button ======== */}
      <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="space-x-2">
            <span className="font-medium">Summary:</span>
            <span>{totalQuestions} questions</span>
            <span>·</span>
            <span>
              Total marks: <b>{totalMarks}</b>
            </span>
          </div>
          <div className="text-xs text-gray-600">
            Cognitive levels: {cognitiveLevels.join(", ")} · NCERT focus: {Math.round(ncertWeight * 100)}%
            {generationMode === "buckets" && ` · ${buckets.length} buckets`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={loading || isSubmitting}
            className="px-6 py-2 rounded-md bg-blue-600 text-white disabled:opacity-60 hover:bg-blue-700 transition-colors"
            aria-busy={loading || isSubmitting}
          >
            {loading || isSubmitting ? "Generating..." : "Generate Enhanced Test"}
          </button>
        </div>
      </div>

      {/* ======== Errors (fallback) ======== */}
      {Object.keys(errors).length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-sm text-red-800 font-medium mb-2">Please fix the following errors:</div>
          <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
            {Object.entries(errors).map(([key, error]) => (
              <li key={key}>{error.message?.toString() || `Invalid ${key}`}</li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
};

export default TestGeneratorForm;