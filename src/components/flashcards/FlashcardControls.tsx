import React from 'react';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  RefreshCw,
  BookOpen
} from 'lucide-react';

interface FlashcardControlsProps {
  onPrevious: () => void;
  onNext: () => void;
  onMaster: () => void;
  onStillLearning: () => void;
  isCurrentMastered: boolean;
  masteredCount: number;
  totalCards: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
}

export default function FlashcardControls({
  onPrevious,
  onNext,
  onMaster,
  onStillLearning,
  isCurrentMastered,
  masteredCount,
  totalCards,
  canGoPrevious,
  canGoNext
}: FlashcardControlsProps) {
  return (
    <div className="mt-8">
      {/* Progress stats */}
      <div className="flex items-center justify-center gap-6 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900">{masteredCount}</div>
          <div className="text-xs text-slate-500">Mastered</div>
        </div>
        <div className="h-8 w-px bg-slate-200"></div>
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900">{totalCards}</div>
          <div className="text-xs text-slate-500">Total Cards</div>
        </div>
        <div className="h-8 w-px bg-slate-200"></div>
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900">
            {Math.round((masteredCount / totalCards) * 100)}%
          </div>
          <div className="text-xs text-slate-500">Progress</div>
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex flex-wrap justify-center items-center gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all ${
            canGoPrevious
              ? 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-md'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <ChevronLeft size={18} />
          Previous
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onStillLearning}
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 hover:shadow-md transition-all"
        >
          <RefreshCw size={18} />
          Still Learning
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onMaster}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold border transition-all ${
            isCurrentMastered
              ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
              : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
          } hover:shadow-md`}
        >
          <CheckCircle2 size={18} />
          {isCurrentMastered ? 'Mastered ✓' : 'Mark as Mastered'}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onNext}
          disabled={!canGoNext}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:from-sky-600 hover:to-blue-700 hover:shadow-lg transition-all ${
            !canGoNext ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          Next
          <ChevronRight size={18} />
        </motion.button>
      </div>

      {/* Quick navigation hint */}
      <div className="mt-6 text-center">
        <p className="text-xs text-slate-500 flex items-center justify-center gap-2">
          <BookOpen size={12} />
          Tip: Use keyboard shortcuts for faster navigation
        </p>
      </div>
    </div>
  );
}