// featureSlides.ts — content for the hero product showcase.
//
// Screenshots live in src/assets/features/<id>-<width>.webp and are built from
// the originals in design/source-images by `python scripts/build-feature-images.py`.
// A slide is shown only when it has a screenshot (or a built-in preview), so a
// feature without a screenshot yet (contests, leaderboard) stays hidden instead
// of showing an empty frame. Drop the screenshot in, re-run the script, done.

export type ShowcaseTheme =
  | "coral"
  | "orange"
  | "green"
  | "lavender"
  | "aqua"
  | "magenta"
  | "butter"
  | "pink";

export interface FeatureSlide {
  id: string;
  /** Short tab label */
  label: string;
  /** Shown in the preview frame's toolbar: "a4ai · <product>" */
  product: string;
  title: string;
  description: string;
  benefits: string[];
  theme: ShowcaseTheme;
  alt: string;
  cta?: { label: string; to: string };
  /** Small honest note in the frame toolbar, e.g. "Sample data" */
  note?: string;
  /** Page colour of the screenshot, used around it when the frame is taller */
  canvas?: string;
  /** Render the built-in coded preview instead of a screenshot */
  builtIn?: "test-generator";
}

// Soft two-stop gradients (light top-left → a little deeper bottom-right), like
// Toddle's feature panels. `accent` colours the dot and check icons.
export const THEMES: Record<ShowcaseTheme, { from: string; to: string; accent: string }> = {
  coral: { from: "#FFEDEF", to: "#FFD3D9", accent: "#D93F4D" },
  orange: { from: "#FFF1E3", to: "#FFD9B5", accent: "#C2410C" },
  green: { from: "#EEF7D6", to: "#D2E9A0", accent: "#4D7C0F" },
  lavender: { from: "#EFEDFF", to: "#D6D1FF", accent: "#5B4BC4" },
  aqua: { from: "#E4F8F3", to: "#BDEBDF", accent: "#047857" },
  magenta: { from: "#FBEAF5", to: "#F2CDE6", accent: "#A21C7A" },
  butter: { from: "#FFF7D9", to: "#FFE6A3", accent: "#9A6B00" },
  pink: { from: "#FFEAF1", to: "#FFCCDD", accent: "#BE185D" },
};

export const FEATURE_SLIDES: FeatureSlide[] = [
  {
    id: "test-generator",
    label: "Tests",
    product: "Test Generator",
    title: "Create exam-ready papers in minutes.",
    description:
      "Pick chapters from the NCERT question bank, set marks, and export a section-wise paper with its answer key.",
    benefits: ["Chapter-wise question selection", "Answer keys included", "PDF & DOCX export"],
    theme: "coral",
    alt: "a4ai Test Generator: subject, class and chapter selection for a new test paper",
    cta: { label: "Try Test Generator", to: "/dashboard/test-generator" },
    builtIn: "test-generator",
  },
  {
    id: "institute-management",
    label: "Institute",
    product: "Institute dashboard",
    title: "Your institute. One connected workspace.",
    description:
      "Departments, teachers, students and batches in one place, with a role for every admin, HOD, proctor and teacher.",
    benefits: ["Departments, teachers & batches", "Role-based access", "Join code for teachers"],
    theme: "orange",
    alt: "a4ai institute dashboard showing departments, teachers, students and batches",
    cta: { label: "Talk to us", to: "/contact" },
    canvas: "#F5F7FB",
  },
  {
    id: "attendance",
    label: "Attendance",
    product: "Attendance",
    title: "Attendance without the daily chaos.",
    description:
      "Teachers mark their own classes; admins and HODs see who has marked today and export day sheets and monthly reports.",
    benefits: ["Faculty marking tracker", "Batch-wise monthly report", "Day sheet export"],
    theme: "green",
    alt: "a4ai attendance page with the faculty marking tracker and daily summary cards",
    cta: { label: "Open dashboard", to: "/dashboard" },
    canvas: "#F8F9FD",
  },
  {
    id: "analytics",
    label: "Analytics",
    product: "Analytics",
    title: "Make class performance easier to read.",
    description:
      "Marks and attendance analytics per batch: trends, marking breakdown and a watchlist of students below the cutoff.",
    benefits: ["Marks & attendance views", "Defaulter watchlist", "Export reports"],
    theme: "lavender",
    alt: "a4ai attendance analytics with attendance rate, trajectory chart and marking breakdown",
    cta: { label: "Open dashboard", to: "/dashboard" },
    note: "Sample data",
    canvas: "#FAF9FF",
  },
  {
    id: "paper-checker",
    label: "Checker",
    product: "Copy Checker",
    title: "Evaluate answers. Spend more time teaching.",
    description:
      "Photograph handwritten copies; AI marks each question against your answer key and you review before anything is sent.",
    benefits: ["Handwritten copies", "Question-wise marks & comments", "Teacher review before publish"],
    theme: "aqua",
    alt: "A handwritten answer sheet with question-wise marks and comments added by the a4ai copy checker",
    cta: { label: "Check copies", to: "/dashboard/test-generator?tab=check" },
    canvas: "#FFFFFF",
  },
  {
    id: "assignments",
    label: "Assignments",
    product: "Assignments",
    title: "Collect copies with one link.",
    description:
      "Share an upload link on WhatsApp; students submit photos or PDFs and you see every copy, status and mark in one table.",
    benefits: ["Upload link for students", "Submission tracking", "Publish results"],
    theme: "magenta",
    alt: "a4ai assignment page with a student upload link and a table of submitted copies",
    cta: { label: "Open dashboard", to: "/dashboard" },
    canvas: "#FFFFFF",
  },
  {
    id: "calendar",
    label: "Calendar",
    product: "Calendar",
    title: "Keep deadlines and classes in one place.",
    description: "A shared academic calendar with assignment deadlines, exams, meetings, holidays and classes.",
    benefits: ["Month, week & agenda views", "Assignment deadlines", "Event categories"],
    theme: "butter",
    alt: "a4ai academic calendar month view with upcoming deadlines and event categories",
    cta: { label: "Open dashboard", to: "/dashboard" },
    canvas: "#FFFFFF",
  },
  {
    id: "live-contests",
    label: "Live Contests",
    product: "Live Contests",
    title: "Turn practice into a live competition.",
    description: "Run timed contests for your class and see participation and scores as students finish.",
    benefits: ["Timed contests", "Live participation", "Results with rank"],
    theme: "pink",
    alt: "a4ai live contest screen",
    cta: { label: "View contests", to: "/contests" },
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    product: "Leaderboard",
    title: "Give students a reason to keep improving.",
    description: "Contest results with a podium, full ranking table and badges students can see.",
    benefits: ["Podium & full ranking", "Result screen with rank", "CSV export for teachers"],
    theme: "green",
    alt: "a4ai contest leaderboard with podium and ranking table",
    cta: { label: "View contests", to: "/contests" },
  },
];

export interface Screenshot {
  src: string;
  srcSet: string;
  width: number;
  height: number;
}

// URLs only (eager) — nothing is downloaded until an <img> uses one.
const files = import.meta.glob<string>("../../assets/features/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

const screenshots: Record<string, Screenshot> = (() => {
  const byId: Record<string, { w: number; url: string }[]> = {};
  for (const [path, url] of Object.entries(files)) {
    const m = /\/([a-z0-9-]+)-(\d+)\.webp$/.exec(path);
    if (!m) continue;
    (byId[m[1]] ??= []).push({ w: Number(m[2]), url });
  }
  const out: Record<string, Screenshot> = {};
  for (const [id, list] of Object.entries(byId)) {
    list.sort((a, b) => a.w - b.w);
    const largest = list[list.length - 1];
    out[id] = {
      src: largest.url,
      srcSet: list.map((x) => `${x.url} ${x.w}w`).join(", "),
      width: largest.w,
      height: Math.round((largest.w * 10) / 16),
    };
  }
  return out;
})();

export function getScreenshot(id: string): Screenshot | null {
  return screenshots[id] ?? null;
}

export const VISIBLE_SLIDES = FEATURE_SLIDES.filter((s) => s.builtIn || getScreenshot(s.id));
