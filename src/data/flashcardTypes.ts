export interface Flashcard {
    id: string | number;
    type: 'definition' | 'formula' | 'reaction' | 'concept' | 'comparison' | 'assumption';
    // Format 1: question/answer
    question?: string;
    answer?: string;
    // Format 2: front/back with additional fields
    title?: string;
    front?: string;
    back?: string;
    open?: string;
    formula?: string | null;
    units?: string | null;
    conditions_or_notes?: string | null;
    examples_or_comparison?: string | null;
  }
  
  export interface Chapter {
    // Format 1: chapter_number/chapter_name format
    chapter_number?: number;
    chapter_name?: string;
    // Format 2: class/chapter format
    class?: string;
    chapter?: string;
    // Common fields
    subject: string;
    flashcards: Flashcard[];
  }
  
  export interface Subject {
    name: string;
    code: string;
    color: string;
    icon: string;
    availableClasses: number[];
  }
  
  export interface ClassData {
    class: number;
    subjects: {
      [subject: string]: {
        chapters: Chapter[];
        totalCards: number;
      };
    };
  }
  
  export interface FlashcardProgress {
    masteredCards: Set<string>; // card IDs
    lastStudied: Date;
    notes: {
      [cardId: string]: {
        keyPoints: string;
        comments: string;
        updatedAt: Date;
      };
    };
  }
  
  export interface DeckState {
    currentDeck: Flashcard[];
    currentCardIndex: number;
    masteredCount: number;
    totalCards: number;
    progressPercentage: number;
  }