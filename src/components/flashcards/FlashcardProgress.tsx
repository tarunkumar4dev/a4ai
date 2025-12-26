import React from 'react';
import { motion } from 'framer-motion';
import { getCircleDashOffset } from '@/data/flashcardUtils';

interface FlashcardProgressProps {
  progress: number;
  currentCard: number;
  totalCards: number;
}

export default function FlashcardProgress({
  progress,
  currentCard,
  totalCards
}: FlashcardProgressProps) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = getCircleDashOffset(progress, radius);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        {/* Background circle */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="8"
            className="text-slate-200"
          />
        </svg>

        {/* Progress circle */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
          <motion.circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            className="text-blue-500"
            initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </svg>

        {/* Progress text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <motion.div
              key={progress}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-2xl font-bold text-slate-900"
            >
              {progress}%
            </motion.div>
            <div className="text-xs text-slate-500 mt-1">
              {currentCard}/{totalCards} cards
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar for mobile */}
      <div className="w-full max-w-md mt-4 md:hidden">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    </div>
  );
}