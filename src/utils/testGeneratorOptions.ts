
// Constants for test generator form options
export const subjects = [
  "Mathematics", "Physics", "Chemistry", "Biology", 
  "Computer Science", "English", "History"
];

export const difficulties = ["Easy", "Medium", "Hard", "Advanced"];

export const questionTypes = [
  "Multiple Choice", "True/False", "Short Answer", 
  "Long Answer", "Fill in the Blanks", "Assertion-Reason"
];

export const questionCounts = ["5", "10", "15", "20", "25", "30"];

export const outputFormats = ["PDF", "DOCX", "HTML", "Plain Text"];

export type TestFormValues = {
  subject: string;
  topic: string;
  difficulty: string;
  questionType: string;
  questionCount: string;
  outputFormat: string;
  additionalRequirements: string;
};
