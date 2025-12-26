import { Flashcard, Chapter } from './flashcardTypes';

export const calculateProgress = (
  masteredCount: number,
  totalCards: number
): number => {
  return totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0;
};

export const getCircleDashOffset = (
  progress: number,
  radius: number = 42
): number => {
  const circumference = 2 * Math.PI * radius;
  return circumference - (progress / 100) * circumference;
};

export const filterChaptersBySubject = (
  chapters: Chapter[],
  subject: string
): Chapter[] => {
  return chapters.filter(chapter => chapter.subject === subject);
};

export const getTotalCardsInDeck = (deck: Flashcard[]): number => {
  return deck.length;
};

export const getCardTypeColor = (type: string): string => {
  const colors = {
    definition: "bg-blue-100 text-blue-800",
    formula: "bg-purple-100 text-purple-800",
    reaction: "bg-green-100 text-green-800"
  };
  return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800";
};

export const saveNotesToLocalStorage = (
  cardId: string,
  keyPoints: string,
  comments: string
): void => {
  const notes = JSON.parse(localStorage.getItem('flashcardNotes') || '{}');
  notes[cardId] = {
    keyPoints,
    comments,
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem('flashcardNotes', JSON.stringify(notes));
};

export const loadNotesFromLocalStorage = (cardId: string): {
  keyPoints: string;
  comments: string;
} => {
  const notes = JSON.parse(localStorage.getItem('flashcardNotes') || '{}');
  return notes[cardId] || { keyPoints: '', comments: '' };
};