// src/components/TestGeneratorForm.tsx
import React, { useMemo } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

/* ===================== Types & Schema ===================== */

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
  board: z.enum(["CBSE", "ICSE", "State"], { required_error: "Select board" }),
  classNum: z.number().int().min(1).max(12),
  subject: z.string().min(1, "Enter subject"),

  topics: z.array(z.string()).default([]),
  subtopics: z.array(z.string()).default([]),

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

  // PATTERN MODE
  patternMode: z.enum(["simple", "blueprint", "matrix"]).default("simple"),

  // BLUEPRINT pattern
  useBlueprint: z.boolean().default(false), // kept for backward compat; tied to patternMode internally
  sections: z.array(SectionSchema).default([]),

  // MATRIX pattern
  markingMatrix: z.array(MatrixRowSchema).default([]),

  language: z.enum(["English", "Hindi"]).default("English"),
  solutionStyle: z.enum(["Steps", "Concise"]).default("Steps"),
  includeAnswerKey: z.boolean().default(true),

  negativeMarking: z.number().min(-10).max(0).default(0),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),

  notes: z.string().max(2000).optional(),

  outputFormat: z.enum(["PDF", "DOCX", "CSV", "JSON"]).default("PDF"),
  watermark: z.boolean().default(false),
  watermarkText: z.string().optional(),
  useLogo: z.boolean().default(true),

  // File inputs: keep as File[] for parent to upload to Storage
  referenceFiles: z.instanceof(File).array().optional(),
})
  .refine((data) => {
    if (data.mode === "mix") {
      const sum = (data.mix.easy || 0) + (data.mix.medium || 0) + (data.mix.hard || 0);
      return sum === 100;
    }
    return true;
  }, { path: ["mix"], message: "Mix must sum to 100%" })
  .refine((d) => (d.patternMode === "blueprint" ? d.sections.length >= 1 : true), {
    path: ["sections"],
    message: "Add at least one section",
  });

export type TestGeneratorFormValues = z.infer<typeof FormSchema>;

type Props = {
  /** Must return a downloadable URL or null */
  onGenerate: (data: TestGeneratorFormValues) => Promise<string | null>;
  loading?: boolean;
  onSaveTemplate?: (data: TestGeneratorFormValues) => Promise<void>;
};

/* ===================== Small Inputs ===================== */

function ChipInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
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
      <label className="block text-sm mb-1">{label}</label>
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

/* ===================== Main Form ===================== */

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
      topics: [],
      subtopics: [],
      questionType: "Multiple Choice",
      mode: "single",
      difficulty: "Easy",
      mix: { easy: 50, medium: 30, hard: 20 },
      qCount: 5,
      marksPerQuestion: 1,
      patternMode: "simple",
      useBlueprint: false,
      sections: [],
      markingMatrix: [],
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
      referenceFiles: [],
      notes: "",
    },
  });

  // Sections (blueprint)
  const { fields, append, remove } = useFieldArray({ control, name: "sections" });
  // Matrix rows
  const matrix = useFieldArray({ control, name: "markingMatrix" });

  const patternMode = watch("patternMode");
  const mode = watch("mode");
  const mix = watch("mix");
  const qCount = watch("qCount");
  const sections = watch("sections");
  const matrixRows = watch("markingMatrix");
  const marksPerQuestion = watch("marksPerQuestion");

  // Force legacy toggle sync
  React.useEffect(() => {
    setValue("useBlueprint", patternMode === "blueprint");
  }, [patternMode, setValue]);

  const totalMarks = useMemo(() => {
    if (patternMode === "blueprint") {
      return sections.reduce((sum, s) => sum + s.count * s.marksPerQuestion, 0);
    }
    if (patternMode === "matrix") {
      return (matrixRows || []).reduce((sum, r) => sum + (r.count || 0) * (r.marksPerQuestion || 0), 0);
    }
    return (qCount || 0) * (marksPerQuestion || 0);
  }, [patternMode, qCount, marksPerQuestion, sections, matrixRows]);

  const totalQuestions = useMemo(() => {
    if (patternMode === "blueprint") return sections.reduce((s, x) => s + (x.count || 0), 0);
    if (patternMode === "matrix") return (matrixRows || []).reduce((s, x) => s + (x.count || 0), 0);
    return qCount || 0;
  }, [patternMode, qCount, sections, matrixRows]);

  const onSubmit = async (data: TestGeneratorFormValues) => {
    await onGenerate(data);
  };

  const errorText = (e?: any) => e && <p className="text-xs text-red-600 mt-1">{e.message?.toString()}</p>;

  // Preset for your screenshot (MCQ 1×10, VSA 2×8, SA 3×10, LA 4×6 = 80)
  const applyCBSE80Preset = () => {
    setValue("patternMode", "matrix");
    matrix.replace([
      { questionType: "Multiple Choice", marksPerQuestion: 1, count: 10 },
      { questionType: "Very Short Answer", marksPerQuestion: 2, count: 8 },
      { questionType: "Short Answer", marksPerQuestion: 3, count: 10 },
      { questionType: "Long Answer", marksPerQuestion: 4, count: 6 },
    ]);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" aria-label="Test Generator Form">
      {/* ======= Header actions ======= */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Create New Test</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={applyCBSE80Preset}
            className="px-3 py-2 rounded-md border hover:bg-slate-100"
            title="Apply CBSE 80-marks matrix"
          >
            CBSE 80 Preset
          </button>
          {onSaveTemplate && (
            <button
              type="button"
              onClick={handleSubmit((d) => onSaveTemplate?.(d))}
              className="px-3 py-2 rounded-md border hover:bg-slate-100"
              title="Save the current configuration as a reusable template"
            >
              Save as Template
            </button>
          )}
        </div>
      </div>

      {/* ======== Basic grid ======== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          <label className="block text-sm mb-1">Question Type</label>
          <select className="w-full border rounded-md px-3 py-2 bg-white" {...register("questionType")}>
            <option>Multiple Choice</option>
            <option>Short Answer</option>
            <option>Long Answer</option>
            <option>Mixed</option>
          </select>
        </div>

        {/* Topics/Subtopics chips */}
        <Controller
          control={control}
          name="topics"
          render={({ field }) => (
            <ChipInput
              label="Topics"
              values={field.value}
              onChange={(v) => field.onChange(v)}
              placeholder="e.g., Ray Optics, Trigonometry"
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
              placeholder="e.g., Interference, Identities"
            />
          )}
        />

        {/* Language & Output */}
        <div>
          <label className="block text-sm mb-1">Language</label>
          <select className="w-full border rounded-md px-3 py-2 bg-white" {...register("language")}>
            <option>English</option>
            <option>Hindi</option>
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

      {/* ======== Difficulty & Pattern selection ======== */}
      <div className="rounded-lg border bg-white">
        <div className="px-4 py-3 border-b font-medium">Question Difficulty & Pattern</div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Difficulty */}
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

          {/* Pattern Mode */}
          <div>
            <label className="block text-sm mb-1">Pattern Mode</label>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2">
                <input type="radio" value="simple" {...register("patternMode")} />
                <span>Simple</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" value="blueprint" {...register("patternMode")} />
                <span>Blueprint (Sections)</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" value="matrix" {...register("patternMode")} />
                <span>Matrix (by Type)</span>
              </label>
            </div>
          </div>

          {/* SIMPLE */}
          {patternMode === "simple" && (
            <>
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
            </>
          )}

          {/* BLUEPRINT */}
          {patternMode === "blueprint" && (
            <div className="md:col-span-2 rounded-md border p-3 space-y-3">
              {fields.map((f, idx) => (
                <div key={f.id} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div>
                    <label className="block text-xs mb-1">Title</label>
                    <input
                      className="w-full border rounded-md px-2 py-2"
                      {...register(`sections.${idx}.title` as const)}
                    />
                  </div>
                  <div>
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
                  <div>
                    <label className="block text-xs mb-1">#</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full border rounded-md px-2 py-2"
                      {...register(`sections.${idx}.count` as const, { valueAsNumber: true })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Marks/Q</label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded-md px-2 py-2"
                      {...register(`sections.${idx}.marksPerQuestion` as const, { valueAsNumber: true })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="h-10 px-3 rounded-md border hover:bg-slate-50"
                      aria-label={`Remove ${watch(`sections.${idx}.title`) || `Section ${idx + 1}`}`}
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
                  append({
                    title: fields.length ? `Section ${String.fromCharCode(65 + fields.length)}` : "Section A",
                    questionType: "Multiple Choice",
                    count: 5,
                    marksPerQuestion: 1,
                  })
                }
                className="mt-1 px-3 py-2 rounded-md border hover:bg-slate-50"
              >
                + Add section
              </button>
            </div>
          )}

          {/* MATRIX */}
          {patternMode === "matrix" && (
            <div className="md:col-span-2 rounded-md border p-3 space-y-3">
              {matrix.fields.map((row, idx) => (
                <div key={row.id} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-xs mb-1">Type of Question</label>
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
                  <div>
                    <label className="block text-xs mb-1">Marks/Q</label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded-md px-2 py-2"
                      {...register(`markingMatrix.${idx}.marksPerQuestion` as const, { valueAsNumber: true })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1"># Questions</label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded-md px-2 py-2"
                      {...register(`markingMatrix.${idx}.count` as const, { valueAsNumber: true })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => matrix.remove(idx)}
                      className="h-10 px-3 rounded-md border hover:bg-slate-50"
                      aria-label={`Remove matrix row ${idx + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => matrix.append({ questionType: "Multiple Choice", marksPerQuestion: 1, count: 0 })}
                className="mt-1 px-3 py-2 rounded-md border hover:bg-slate-50"
              >
                + Add Row
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ======== Behaviour, References, Watermark ======== */}
      <details className="rounded-lg border bg-white open:shadow-sm">
        <summary className="cursor-pointer list-none px-4 py-3 font-medium">
          Advanced settings
          <span className="ml-2 text-xs text-slate-500">(marking, shuffle, references, watermark)</span>
        </summary>

        <div className="px-4 pb-4 pt-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="flex items-center gap-3">
              <input id="shuffleQ" type="checkbox" {...register("shuffleQuestions")} />
              <label htmlFor="shuffleQ">Shuffle questions</label>
            </div>
            <div className="flex items-center gap-3">
              <input id="shuffleOpt" type="checkbox" {...register("shuffleOptions")} />
              <label htmlFor="shuffleOpt">Shuffle MCQ options</label>
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
              <span className="font-medium">Note:</span> txt/csv/md are parsed directly on the server today; pdf/doc/docx extraction can
              be added client-side to pass plain text.
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

      {/* ======== Summary ======== */}
      <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
        <div className="space-x-2">
          <span className="font-medium">Summary:</span>
          <span>{totalQuestions} questions</span>
          <span>·</span>
          <span>
            Total marks: <b>{totalMarks}</b>
          </span>
          {patternMode === "matrix" && totalMarks !== 80 && (
            <span className="text-amber-600 ml-2">(Tip: For CBSE preset, total is 80)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={loading || isSubmitting}
            className="px-4 py-2 rounded-md bg-black text-white disabled:opacity-60"
            aria-busy={loading || isSubmitting}
          >
            {loading || isSubmitting ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>

      {/* ======== Errors (fallback) ======== */}
      {Object.keys(errors).length > 0 && <div className="text-xs text-red-600">Please fix the highlighted fields.</div>}
    </form>
  );
};

export default TestGeneratorForm;
