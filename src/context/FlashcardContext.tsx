import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Flashcard, Chapter } from '@/data/flashcardTypes';
import { allFlashcards } from '@/data/ncertFlashcards';

interface FlashcardContextType {
  selectedClass: number | null;
  selectedSubject: string | null;
  selectedChapter: number | null;
  currentDeck: Flashcard[];
  currentCardIndex: number;
  masteredCards: Set<string>;
  progress: number;
  
  // Actions
  selectClass: (classNum: number) => void;
  selectSubject: (subject: string) => void;
  selectChapter: (chapterNum: number) => void;
  nextCard: () => void;
  previousCard: () => void;
  markAsMastered: (cardId: string) => void;
  saveNotes: (cardId: string, keyPoints: string, comments: string) => void;
  
  // Getters
  getAvailableSubjects: () => string[];
  getAvailableChapters: () => Chapter[];
  getDeckTitle: () => string;
  getDeckSubtitle: () => string;
}

const FlashcardContext = createContext<FlashcardContextType | undefined>(undefined);

export const useFlashcards = () => {
  const context = useContext(FlashcardContext);
  if (!context) {
    throw new Error('useFlashcards must be used within FlashcardProvider');
  }
  return context;
};

interface FlashcardProviderProps {
  children: ReactNode;
  initialClass?: number | null;
  initialSubject?: string | null;
  initialChapter?: number | null;
}

export const FlashcardProvider: React.FC<FlashcardProviderProps> = ({ 
  children,
  initialClass = null,
  initialSubject = null,
  initialChapter = null
}) => {
  const [selectedClass, setSelectedClass] = useState<number | null>(initialClass ?? 10); // Default to Class 10
  const [selectedSubject, setSelectedSubject] = useState<string | null>(initialSubject ?? 'Science');
  const [selectedChapter, setSelectedChapter] = useState<number | null>(initialChapter ?? 1);
  const [currentDeck, setCurrentDeck] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [masteredCards, setMasteredCards] = useState<Set<string>>(new Set());

  // Normalize chapter data to handle both formats
  const normalizeChapter = useCallback((chapter: Chapter, index: number): Chapter => {
    // If chapter already has chapter_number, return as is
    if (chapter.chapter_number !== undefined) {
      return chapter;
    }
    // Otherwise, normalize from class/chapter format
    return {
      ...chapter,
      chapter_number: index + 1,
      chapter_name: chapter.chapter || `Chapter ${index + 1}`,
    };
  }, []);

  // Load deck when class, subject, or chapter changes
  const loadDeck = useCallback(() => {
    if (!selectedClass || !selectedSubject || !selectedChapter) {
      setCurrentDeck([]);
      return;
    }

    const classKey = selectedClass.toString();
    const subjectData = allFlashcards[classKey as keyof typeof allFlashcards]?.[selectedSubject];
    
    if (subjectData) {
      // Normalize chapters and find by chapter_number
      const normalizedChapters = subjectData.map((ch, idx) => normalizeChapter(ch, idx));
      const chapter = normalizedChapters.find(ch => ch.chapter_number === selectedChapter);
      if (chapter) {
        setCurrentDeck(chapter.flashcards);
        setCurrentCardIndex(0);
      }
    }
  }, [selectedClass, selectedSubject, selectedChapter, normalizeChapter]);

  // Effects
  React.useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  // Update state when initial props change (for URL-based navigation)
  React.useEffect(() => {
    if (initialClass !== null && initialClass !== undefined) {
      setSelectedClass(initialClass);
    }
  }, [initialClass]);

  React.useEffect(() => {
    if (initialSubject !== null && initialSubject !== undefined) {
      setSelectedSubject(initialSubject);
    }
  }, [initialSubject]);

  React.useEffect(() => {
    if (initialChapter !== null && initialChapter !== undefined) {
      setSelectedChapter(initialChapter);
    }
  }, [initialChapter]);

  // Load mastered cards from localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem('flashcardMastered');
    if (saved) {
      setMasteredCards(new Set(JSON.parse(saved)));
    }
  }, []);

  // Save mastered cards to localStorage
  React.useEffect(() => {
    localStorage.setItem('flashcardMastered', JSON.stringify([...masteredCards]));
  }, [masteredCards]);

  // Actions
  const selectClass = useCallback((classNum: number) => {
    setSelectedClass(classNum);
    setSelectedSubject(null);
    setSelectedChapter(null);
  }, []);

  const selectSubject = useCallback((subject: string) => {
    setSelectedSubject(subject);
    setSelectedChapter(null);
  }, []);

  const selectChapter = useCallback((chapterNum: number) => {
    setSelectedChapter(chapterNum);
  }, []);

  const nextCard = useCallback(() => {
    if (currentCardIndex < currentDeck.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
    }
  }, [currentCardIndex, currentDeck.length]);

  const previousCard = useCallback(() => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
    }
  }, [currentCardIndex]);

  const markAsMastered = useCallback((cardId: string) => {
    setMasteredCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  }, []);

  const saveNotes = useCallback((cardId: string, keyPoints: string, comments: string) => {
    const notes = JSON.parse(localStorage.getItem('flashcardNotes') || '{}');
    notes[cardId] = {
      keyPoints,
      comments,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('flashcardNotes', JSON.stringify(notes));
  }, []);

  // Getters
  const getAvailableSubjects = useCallback(() => {
    if (!selectedClass) return [];
    const classKey = selectedClass.toString();
    return Object.keys(allFlashcards[classKey as keyof typeof allFlashcards] || {});
  }, [selectedClass]);

  const getAvailableChapters = useCallback(() => {
    if (!selectedClass || !selectedSubject) return [];
    const classKey = selectedClass.toString();
    const chapters = allFlashcards[classKey as keyof typeof allFlashcards]?.[selectedSubject] || [];
    // Normalize chapters to ensure they all have chapter_number and chapter_name
    return chapters.map((ch, idx) => {
      if (ch.chapter_number !== undefined) {
        return ch;
      }
      return {
        ...ch,
        chapter_number: idx + 1,
        chapter_name: ch.chapter || `Chapter ${idx + 1}`,
      };
    });
  }, [selectedClass, selectedSubject]);

  const getDeckTitle = useCallback(() => {
    if (!selectedChapter || !selectedSubject || !selectedClass) return 'Select a Chapter';
    
    const classKey = selectedClass.toString();
    const chapters = allFlashcards[classKey as keyof typeof allFlashcards]?.[selectedSubject] || [];
    // Normalize and find chapter
    const normalizedChapters = chapters.map((ch, idx) => {
      if (ch.chapter_number !== undefined) {
        return ch;
      }
      return {
        ...ch,
        chapter_number: idx + 1,
        chapter_name: ch.chapter || `Chapter ${idx + 1}`,
      };
    });
    const chapter = normalizedChapters.find(ch => ch.chapter_number === selectedChapter);
    
    return chapter?.chapter_name || 'Unknown Chapter';
  }, [selectedClass, selectedSubject, selectedChapter]);

  const getDeckSubtitle = useCallback(() => {
    if (!selectedClass || !selectedSubject) return 'Select a subject';
    return `Class ${selectedClass} • ${selectedSubject}`;
  }, [selectedClass, selectedSubject]);

  const progress = currentDeck.length > 0 
    ? Math.round((masteredCards.size / currentDeck.length) * 100)
    : 0;

  const value: FlashcardContextType = {
    selectedClass,
    selectedSubject,
    selectedChapter,
    currentDeck,
    currentCardIndex,
    masteredCards,
    progress,
    
    selectClass,
    selectSubject,
    selectChapter,
    nextCard,
    previousCard,
    markAsMastered,
    saveNotes,
    
    getAvailableSubjects,
    getAvailableChapters,
    getDeckTitle,
    getDeckSubtitle,
  };

  return (
    <FlashcardContext.Provider value={value}>
      {children}
    </FlashcardContext.Provider>
  );
};