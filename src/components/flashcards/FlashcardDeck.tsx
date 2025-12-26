import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flashcard } from '@/data/flashcardTypes';
import FlashcardCard from './FlashcardCard';
import FlashcardControls from './FlashcardControls';
import FlashcardProgress from './FlashcardProgress';
import FlashcardNotes from './FlashcardNotes';
import { calculateProgress } from '@/data/flashcardUtils';
import { BookOpen, Zap, Target } from 'lucide-react';

interface FlashcardDeckProps {
  deck: Flashcard[];
  deckTitle: string;
  deckSubtitle: string;
  onMasterCard: (cardId: string) => void;
  masteredCardIds: Set<string>;
  onSaveNotes: (cardId: string, keyPoints: string, comments: string) => void;
}

export default function FlashcardDeck({
  deck,
  deckTitle,
  deckSubtitle,
  onMasterCard,
  masteredCardIds,
  onSaveNotes
}: FlashcardDeckProps) {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [keyPoints, setKeyPoints] = useState('');
  const [comments, setComments] = useState('');

  const currentCard = deck[currentCardIndex];
  const isCurrentMastered = masteredCardIds.has(currentCard.id);
  const masteredCount = masteredCardIds.size;
  const totalCards = deck.length;
  const progress = calculateProgress(masteredCount, totalCards);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'Enter':
          handleNext();
          break;
        case 'ArrowLeft':
          handlePrevious();
          break;
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          handleFlip();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentCardIndex, deck.length]);

  const handleFlip = useCallback(() => {
    setIsFlipped(!isFlipped);
  }, [isFlipped]);

  const handleNext = useCallback(() => {
    if (currentCardIndex < deck.length - 1) {
      setIsFlipped(false);
      setCurrentCardIndex(prev => prev + 1);
      // Reset notes for new card
      setKeyPoints('');
      setComments('');
    }
  }, [currentCardIndex, deck.length]);

  const handlePrevious = useCallback(() => {
    if (currentCardIndex > 0) {
      setIsFlipped(false);
      setCurrentCardIndex(prev => prev - 1);
      // Reset notes for new card
      setKeyPoints('');
      setComments('');
    }
  }, [currentCardIndex]);

  const handleMaster = useCallback(() => {
    onMasterCard(currentCard.id);
  }, [currentCard.id, onMasterCard]);

  const handleStillLearning = useCallback(() => {
    // Animation feedback
    const cardElement = document.querySelector('.preserve-3d');
    if (cardElement) {
      cardElement.classList.add('animate-pulse');
      setTimeout(() => cardElement.classList.remove('animate-pulse'), 500);
    }
  }, []);

  const handleSaveNotes = useCallback(() => {
    onSaveNotes(currentCard.id, keyPoints, comments);
    
    // Show success feedback
    const saveBtn = document.querySelector('#saveNotesBtn');
    if (saveBtn) {
      saveBtn.innerHTML = '✓ Notes Saved';
      setTimeout(() => {
        saveBtn.innerHTML = '💾 Save Notes for This Card';
      }, 2000);
    }
  }, [currentCard.id, keyPoints, comments, onSaveNotes]);

  if (!deck || deck.length === 0) {
    return (
      <div className="glass-effect rounded-3xl p-12 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <BookOpen className="text-blue-600" size={32} />
        </div>
        <h3 className="text-2xl font-bold text-slate-900 mb-3">
          No Flashcards Available
        </h3>
        <p className="text-slate-600 mb-6 max-w-md mx-auto">
          Select a chapter to start learning with interactive flashcards.
        </p>
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Zap size={16} />
            <span>Interactive learning</span>
          </div>
          <div className="h-4 w-px bg-slate-200"></div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Target size={16} />
            <span>Track progress</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentCardIndex}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="space-y-8"
      >
        {/* Deck header */}
        <div className="glass-effect rounded-3xl p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-widest">
                  Smart Flashcards
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                {deckTitle}
              </h2>
              <p className="text-slate-600 mt-1">
                {deckSubtitle}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <FlashcardProgress
                progress={progress}
                currentCard={currentCardIndex + 1}
                totalCards={totalCards}
              />
            </div>
          </div>
        </div>

        {/* Flashcard and Notes Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Flashcard column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Flashcard display */}
            <div className="glass-effect rounded-3xl p-6">
              <FlashcardCard
                card={currentCard}
                isFlipped={isFlipped}
                onFlip={handleFlip}
                currentNumber={currentCardIndex + 1}
                totalCards={totalCards}
              />
            </div>

            {/* Controls */}
            <div className="glass-effect rounded-3xl p-6">
              <FlashcardControls
                onPrevious={handlePrevious}
                onNext={handleNext}
                onMaster={handleMaster}
                onStillLearning={handleStillLearning}
                isCurrentMastered={isCurrentMastered}
                masteredCount={masteredCount}
                totalCards={totalCards}
                canGoPrevious={currentCardIndex > 0}
                canGoNext={currentCardIndex < deck.length - 1}
              />
            </div>
          </div>

          {/* Notes column */}
          <div className="lg:col-span-1">
            <FlashcardNotes
              keyPoints={keyPoints}
              comments={comments}
              onKeyPointsChange={setKeyPoints}
              onCommentsChange={setComments}
              onSave={handleSaveNotes}
              cardId={currentCard.id}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}