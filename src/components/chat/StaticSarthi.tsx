// Static help bot (teacher + student dashboards). No AI call, no network, no animation, no drag:
// fixed answers + shortcut buttons, so it costs nothing to render in the Play Store WebView.
// Typed questions are matched to a topic by keywords; anything else gets the topic list + support email.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, X, Send } from "lucide-react";

type Action = { label: string; path?: string; tab?: string; href?: string };
type Topic = { id: string; question: string; keywords: string[]; answer: string; actions: Action[] };
type Msg = { from: "bot" | "user"; text: string; actions?: Action[]; chips?: boolean };

const SUPPORT: Action = { label: "Email support", href: "mailto:a4ai.team@gmail.com" };

const TEACHER_TOPICS: Topic[] = [
  {
    id: "test",
    question: "How do I generate a test paper?",
    keywords: ["test", "paper", "generate", "question", "ncert", "blueprint", "pdf", "word", "docx", "logo"],
    answer:
      "Open the Test Generator, pick class, subject and chapters, choose question types and marks, then generate. " +
      "You get the paper with an answer key and can download it as PDF or Word (.docx).",
    actions: [{ label: "Open Test Generator", path: "/dashboard/test-generator" }],
  },
  {
    id: "check",
    question: "How does AI copy checking work?",
    keywords: ["check", "copy", "copies", "sheet", "grade", "grading", "evaluate", "handwritten", "checker"],
    answer:
      "Go to Test Generator → Check Copies. Choose a saved test (or upload the question paper), then take photos or " +
      "upload PDFs of each student's copy. The AI suggests marks per question; you review and approve.",
    actions: [{ label: "Open Check Copies", path: "/dashboard/test-generator?tab=check" }],
  },
  {
    id: "attendance",
    question: "Attendance and analytics",
    keywords: ["attendance", "absent", "present", "analytics", "marks", "report", "defaulter", "excel"],
    answer:
      "Mark attendance for your classes in the Attendance tab. The Analytics tab shows attendance and marks for your " +
      "batches, with export to Excel.",
    actions: [
      { label: "Attendance", tab: "attendance" },
      { label: "Analytics", tab: "analytics" },
    ],
  },
  {
    id: "assignments",
    question: "Assignments and the student portal",
    keywords: ["assignment", "homework", "submit", "submission", "portal", "student", "access code"],
    answer:
      "Create an assignment for your batch in the Assignments tab. Students open the student portal with their access " +
      "code, submit a PDF, and see your grade after you approve it.",
    actions: [{ label: "Assignments", tab: "assignments" }],
  },
  {
    id: "pricing",
    question: "Plans and pricing",
    keywords: ["price", "pricing", "plan", "plans", "upgrade", "pay", "payment", "subscription", "free", "pro", "starter"],
    answer: "Current plans, limits and prices are on the Pricing page. You can upgrade there with UPI or card.",
    actions: [{ label: "View plans", path: "/pricing" }],
  },
  {
    id: "support",
    question: "Talk to the a4ai team",
    keywords: ["help", "support", "contact", "problem", "issue", "bug", "error", "call", "email"],
    answer: "Write to a4ai.team@gmail.com with your registered email and a screenshot. We usually reply within a day.",
    actions: [SUPPORT],
  },
];

const STUDENT_TOPICS: Topic[] = [
  {
    id: "practice",
    question: "How do I practice questions?",
    keywords: ["practice", "question", "pyq", "chapter", "solve", "revise"],
    answer: "Open Practice, pick your class, subject and chapter, and solve questions with answers and explanations.",
    actions: [
      { label: "Practice", path: "/practice" },
      { label: "Daily practice", path: "/daily-practice" },
    ],
  },
  {
    id: "contests",
    question: "Contests",
    keywords: ["contest", "quiz", "compete", "leaderboard", "rank"],
    answer: "Join a live contest, answer within the time limit and see where you rank on the leaderboard.",
    actions: [{ label: "Contests", path: "/contests" }],
  },
  {
    id: "flashcards",
    question: "Flashcards",
    keywords: ["flashcard", "flash", "card", "memorize", "revision"],
    answer: "Flashcards help you revise key terms chapter by chapter.",
    actions: [{ label: "Flashcards", path: "/dashboard/flashcards" }],
  },
  {
    id: "support",
    question: "Talk to the a4ai team",
    keywords: ["help", "support", "contact", "problem", "issue", "bug", "error", "email"],
    answer: "Write to a4ai.team@gmail.com with your registered email and a screenshot. We usually reply within a day.",
    actions: [SUPPORT],
  },
];

function matchTopic(topics: Topic[], text: string): Topic | null {
  const q = text.toLowerCase();
  let best: Topic | null = null;
  let bestScore = 0;
  for (const t of topics) {
    const score = t.keywords.reduce((n, k) => (q.includes(k) ? n + 1 : n), 0);
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}

export default function StaticSarthi({
  variant,
  onTab,
  accent = "#E8643A",
}: {
  variant: "teacher" | "student";
  /** teacher dashboard: switch to an in-page tab */
  onTab?: (tab: string) => void;
  accent?: string;
}) {
  const navigate = useNavigate();
  const topics = variant === "teacher" ? TEACHER_TOPICS : STUDENT_TOPICS;
  const greeting =
    variant === "teacher"
      ? "Hi! I'm AI Sarthi. Pick a question below or type one."
      : "Hi! I'm your a4ai assistant. Pick a question below or type one.";

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", text: greeting, chips: true }]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, open]);

  const answer = (question: string, topic: Topic | null) => {
    const reply: Msg = topic
      ? { from: "bot", text: topic.answer, actions: topic.actions, chips: true }
      : {
          from: "bot",
          text: "I can only help with the topics below. For anything else, email the a4ai team.",
          actions: [SUPPORT],
          chips: true,
        };
    // older replies drop their chips so only the latest list is shown
    setMsgs((m) => [...m.map((x) => ({ ...x, chips: false })), { from: "user", text: question }, reply]);
  };

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    answer(text, matchTopic(topics, text));
  };

  const runAction = (a: Action) => {
    if (a.href) {
      window.location.href = a.href;
      return;
    }
    if (a.tab && onTab) {
      onTab(a.tab);
      setOpen(false);
      return;
    }
    if (a.path) navigate(a.path);
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[110] flex flex-col items-end gap-3">
      {open && (
        <div className="w-[calc(100vw-2rem)] sm:w-96 h-[70vh] max-h-[520px] rounded-2xl shadow-xl overflow-hidden flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
          <div className="px-4 py-3 flex items-center justify-between text-white shrink-0" style={{ background: accent }}>
            <span className="font-bold text-sm">{variant === "teacher" ? "AI Sarthi · Quick help" : "a4ai · Quick help"}</span>
            <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-white/20" aria-label="Close">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50 dark:bg-slate-950">
            {msgs.map((m, i) => (
              <div key={i} className="space-y-2">
                <div className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`px-3 py-2 rounded-2xl max-w-[85%] text-sm whitespace-pre-wrap ${
                      m.from === "user"
                        ? "text-white rounded-br-sm"
                        : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-sm"
                    }`}
                    style={m.from === "user" ? { background: accent } : undefined}
                  >
                    {m.text}
                  </div>
                </div>
                {m.actions && m.actions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {m.actions.map((a) => (
                      <button
                        key={a.label}
                        type="button"
                        onClick={() => runAction(a)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                        style={{ background: accent }}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
                {m.chips && (
                  <div className="flex flex-wrap gap-1.5">
                    {topics.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => answer(t.question, t)}
                        className="px-3 py-1 rounded-full text-xs font-medium text-left border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                      >
                        {t.question}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <form
            className="p-2 flex gap-2 border-t border-slate-200 dark:border-slate-700 shrink-0"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a question…"
              className="flex-1 min-w-0 rounded-xl px-3 py-2 text-base sm:text-sm bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-3 rounded-xl text-white disabled:opacity-40"
              style={{ background: accent }}
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white"
        style={{ background: accent }}
        aria-label={open ? "Close help" : "Open help"}
      >
        {open ? <X size={24} /> : <MessageCircle size={26} />}
      </button>
    </div>
  );
}
