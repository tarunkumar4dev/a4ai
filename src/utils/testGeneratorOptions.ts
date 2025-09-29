// Constants for test generator form options
export const subjects = [
  "Mathematics", "Physics", "Chemistry", "Biology", 
  "Computer Science", "English", "History"
];

// added "Mixed" instead of "Advanced" so backend types align
export const difficulties = ["Easy", "Medium", "Hard", "Mixed"];

export const questionTypes = [
  "Multiple Choice", "True/False", "Short Answer", 
  "Long Answer", "Fill in the Blanks", "Assertion-Reason"
];

export const questionCounts = ["5", "10", "15", "20", "25", "30"];

export const outputFormats = ["PDF", "DOCX", "HTML", "Plain Text"];

/* --------------------- Patched form values --------------------- */
export type TestFormValues = {
  subject: string;
  topic: string;
  difficulty: string;
  questionType: string;
  questionCount: string;
  outputFormat: string;
  additionalRequirements: string;

  // NEW (for sectioned mode)
  sectionMode?: "on" | "off";     // default off
  sectionsJSON?: string;          // JSON.stringify of sections array
  computedTotalMarks?: string;    // optional: calculated in UI
};
