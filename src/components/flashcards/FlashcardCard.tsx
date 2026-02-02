import React, { useState } from 'react';
import { Flashcard } from '@/data/flashcardTypes';
import { motion, AnimatePresence } from 'framer-motion';
import { getCardTypeColor } from '@/data/flashcardUtils';

interface FlashcardCardProps {
  card: Flashcard;
  isFlipped: boolean;
  onFlip: () => void;
  currentNumber: number;
  totalCards: number;
}

export default function FlashcardCard({
  card,
  isFlipped,
  onFlip,
  currentNumber,
  totalCards
}: FlashcardCardProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleFlip = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    onFlip();
    setTimeout(() => setIsAnimating(false), 600);
  };

  // Support both question/answer and front/back formats
  const question = card.question || card.front || '';
  const answer = card.answer || card.back || '';

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Card counter */}
      <div className="absolute -top-12 right-0 bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-lg">
        <span className="text-sm font-semibold text-slate-700">
          Card {currentNumber} of {totalCards}
        </span>
      </div>

      {/* 3D Card Container */}
      <div className="relative w-full h-80 md:h-96 perspective-1200">
        <motion.div
          className="relative w-full h-full preserve-3d"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{
            duration: 0.7,
            ease: [0.23, 1, 0.32, 1]
          }}
          onClick={handleFlip}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front of Card */}
          <div className="absolute inset-0 w-full h-full backface-hidden rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-sky-50/90 to-blue-100/70" />
            <div className="absolute inset-0 bg-white/30 backdrop-blur-sm" />
            
            <div className="relative z-10 h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="mb-6">
                <div className={`inline-flex px-3 py-1 rounded-full ${getCardTypeColor(card.type)} text-xs font-semibold mb-4`}>
                  {card.type.toUpperCase()}
                </div>
                <div className="w-16 h-16 rounded-full bg-white/80 flex items-center justify-center mb-4 shadow-lg mx-auto">
                  <span className="text-sky-600 text-2xl font-bold">Q</span>
                </div>
                <p className="text-xs font-semibold text-sky-600 uppercase tracking-widest mb-3">
                  Question
                </p>
              </div>
              
              <h3 className="text-xl md:text-2xl font-bold text-slate-900 leading-snug mb-8 px-4">
                {question}
              </h3>
              
              <div className="absolute bottom-6 left-0 right-0">
                <div className="flex items-center justify-center gap-2 text-sm text-slate-600 animate-pulse">
                  <span className="inline-flex h-2 w-2 rounded-full bg-sky-400"></span>
                  <span>Click or press Space to flip</span>
                </div>
              </div>
            </div>
          </div>

          {/* Back of Card */}
          <div 
            className="absolute inset-0 w-full h-full backface-hidden rounded-3xl overflow-hidden"
            style={{ transform: 'rotateY(180deg)' }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500 to-blue-600" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
            
            <div className="relative z-10 h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="mb-6">
                <div className="w-16 h-16 rounded-full bg-white/15 flex items-center justify-center mb-4 shadow-inner mx-auto">
                  <span className="text-white text-2xl font-bold">A</span>
                </div>
                <p className="text-xs font-semibold text-white/80 uppercase tracking-widest mb-3">
                  Answer
                </p>
              </div>
              
              <div className="text-lg md:text-xl font-semibold text-white leading-relaxed mb-8 px-4 whitespace-pre-line">
                {answer}
              </div>
              
              <div className="absolute bottom-6 left-0 right-0">
                <div className="flex items-center justify-center gap-2 text-sm text-white/85">
                  <span className="inline-flex h-2 w-2 rounded-full bg-white/70"></span>
                  <span>Click again to see question</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Keyboard hint */}
      <div className="mt-6 text-center">
        <p className="text-xs text-slate-500">
          <kbd className="px-2 py-1 bg-slate-100 rounded text-slate-700">Space</kbd> to flip • 
          <kbd className="px-2 py-1 bg-slate-100 rounded text-slate-700 mx-2">← →</kbd> to navigate • 
          <kbd className="px-2 py-1 bg-slate-100 rounded text-slate-700">Enter</kbd> for next
        </p>
      </div>
    </div>
  );
}