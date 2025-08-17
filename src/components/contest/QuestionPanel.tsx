import { ContestQuestion } from "@/hooks/useContestQuestions";

type Props = {
  questions: ContestQuestion[];
  answers: Record<string, string>;
  currentIndex: number;
  onSelect: (questionId: string, option: string) => void;
  onPrev: () => void;
  onNext: () => void;
};

export default function QuestionPanel({
  questions,
  answers,
  currentIndex,
  onSelect,
  onPrev,
  onNext
}: Props) {
  if (!questions.length) return null;
  const q = questions[currentIndex];
  const total = questions.length;

  return (
    <div className="w-full space-y-4 mt-6">
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Question {currentIndex + 1} / {total}
        </span>
        <span>Unanswered: {total - Object.keys(answers).length}</span>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow">
        {/* image (optional) */}
        {q.image_url && (
          <div className="mb-3">
            <img
              src={q.image_url}
              alt="Question"
              className="w-full max-h-64 object-contain rounded border"
              loading="lazy"
            />
          </div>
        )}

        <h3 className="font-semibold text-lg mb-3">{q.question_text}</h3>

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
                onChange={() => onSelect(q.id, opt)}
                className="accent-indigo-600"
              />
              {opt}
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onPrev}
          className="px-4 py-2 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
          disabled={currentIndex === 0}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          className="px-4 py-2 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
          disabled={currentIndex === total - 1}
        >
          Next
        </button>
      </div>
    </div>
  );
}
