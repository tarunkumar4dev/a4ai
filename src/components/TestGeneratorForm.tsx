import React, { useState } from "react";

export type TestGeneratorFormValues = {
  subject?: string;
  difficulty?: string;    // "Easy" | "Medium" | "Hard"
  questionType?: string;  // "Multiple Choice" | "Short Answer" | "Mixed"
  qCount?: number;
  itemCount?: number;     // legacy alias
};

type Props = {
  /** Must return a downloadable URL or null */
  onGenerate: (data: TestGeneratorFormValues) => Promise<string | null>;
  loading?: boolean;
};

const TestGeneratorForm: React.FC<Props> = ({ onGenerate, loading }) => {
  const [values, setValues] = useState<TestGeneratorFormValues>({
    subject: "",
    difficulty: "Easy",
    questionType: "Multiple Choice",
    qCount: 5,
  });

  const onChange =
    (key: keyof TestGeneratorFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const v = e.target.value;
      setValues((s) => ({
        ...s,
        [key]:
          key === "qCount" || key === "itemCount"
            ? Number(v)
            : v,
      }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onGenerate(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1">Subject</label>
          <input
            className="w-full border rounded-md px-3 py-2"
            placeholder="Maths / Science / ..."
            value={values.subject ?? ""}
            onChange={onChange("subject")}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Difficulty</label>
          <select
            className="w-full border rounded-md px-3 py-2"
            value={values.difficulty ?? "Easy"}
            onChange={onChange("difficulty")}
          >
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Question Type</label>
          <select
            className="w-full border rounded-md px-3 py-2"
            value={values.questionType ?? "Multiple Choice"}
            onChange={onChange("questionType")}
          >
            <option>Multiple Choice</option>
            <option>Short Answer</option>
            <option>Mixed</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1"># Questions</label>
          <input
            type="number"
            min={1}
            className="w-full border rounded-md px-3 py-2"
            value={Number(values.qCount ?? 5)}
            onChange={onChange("qCount")}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 rounded-md bg-black text-white disabled:opacity-60"
      >
        {loading ? "Generating..." : "Generate"}
      </button>
    </form>
  );
};

export default TestGeneratorForm;
