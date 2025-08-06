import { useState } from "react";

interface Question {
  id: string;
  text: string;
  options: string[];
}

export default function QuestionPanel({ contestId }: { contestId: string }) {
  // TODO: Replace with Supabase fetch later
  const sampleQuestions: Question[] = [
    {
      id: "q1",
      text: "What is the output of 2 + 2?",
      options: ["2", "3", "4", "5"],
    },
    {
      id: "q2",
      text: "Which language is used for styling web pages?",
      options: ["HTML", "CSS", "JavaScript", "Python"],
    },
  ];

  const [answers, setAnswers] = useState<{ [key: string]: string }>({});

  const handleChange = (qid: string, option: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: option }));
  };

  return (
    <div className="w-full space-y-6 mt-8">
      {sampleQuestions.map((q, index) => (
        <div
          key={q.id}
          className="bg-white p-4 rounded-lg border border-gray-200 shadow"
        >
          <h3 className="font-semibold text-lg mb-2">
            Q{index + 1}. {q.text}
          </h3>
          <div className="grid gap-2">
            {q.options.map((opt) => (
              <label
                key={opt}
                className={`flex items-center gap-2 px-4 py-2 rounded cursor-pointer border ${
                  answers[q.id] === opt
                    ? "bg-indigo-100 border-indigo-400"
                    : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name={q.id}
                  value={opt}
                  checked={answers[q.id] === opt}
                  onChange={() => handleChange(q.id, opt)}
                  className="accent-indigo-600"
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
