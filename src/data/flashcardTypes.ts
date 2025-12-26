export interface Flashcard {
    id: string;
    question: string;
    answer: string;
    type: 'definition' | 'formula' | 'reaction';
  }
  
  export interface Chapter {
    chapter_number: number;
    chapter_name: string;
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