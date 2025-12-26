import React from 'react';
import { motion } from 'framer-motion';
import { Chapter } from '@/data/flashcardTypes';
import { BookOpen, CheckCircle, Lock } from 'lucide-react';

interface ChapterSelectorProps {
  chapters: Chapter[];
  selectedChapter: number | null;
  onSelectChapter: (chapterNumber: number) => void;
  subject: string;
  className?: string;
}

export default function ChapterSelector({
  chapters,
  selectedChapter,
  onSelectChapter,
  subject,
  className = ''
}: ChapterSelectorProps) {
  const getSubjectGradient = (subject: string) => {
    const gradients: Record<string, string> = {
      Chemistry: 'from-blue-400 to-cyan-500',
      Physics: 'from-purple-400 to-pink-500',
      Biology: 'from-emerald-400 to-green-500',
      Mathematics: 'from-indigo-400 to-purple-500'
    };
    return gradients[subject] || 'from-slate-400 to-slate-500';
  };

  if (chapters.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-effect rounded-3xl p-8 text-center"
      >
        <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock className="text-amber-600" size={28} />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">
          Chapters Coming Soon
        </h3>
        <p className="text-slate-600 mb-4">
          We're working hard to add chapters for this subject.
        </p>
        <p className="text-sm text-slate-500">
          In the meantime, try <strong>Class 10 Science</strong> which has full NCERT coverage.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-effect rounded-3xl p-6 ${className}`}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getSubjectGradient(subject)} flex items-center justify-center`}>
          <BookOpen className="text-white" size={20} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Select Chapter</h3>
          <p className="text-sm text-slate-500">
            {chapters.length} chapters available • {subject}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {chapters.map((chapter) => {
          const isSelected = selectedChapter === chapter.chapter_number;
          
          return (
            <motion.button
              key={chapter.chapter_number}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectChapter(chapter.chapter_number)}
              className={`group relative p-4 rounded-2xl border transition-all duration-300 ${
                isSelected
                  ? 'bg-white border-blue-300 ring-2 ring-offset-2 ring-blue-400 shadow-lg'
                  : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300 hover:shadow-md'
              }`}
            >
              {/* Background gradient effect */}
              <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-300 ${
                chapter.subject === 'Chemistry' ? 'bg-gradient-to-br from-blue-400 to-cyan-400' :
                chapter.subject === 'Physics' ? 'bg-gradient-to-br from-purple-400 to-pink-400' :
                chapter.subject === 'Biology' ? 'bg-gradient-to-br from-emerald-400 to-green-400' :
                'bg-gradient-to-br from-indigo-400 to-purple-400'
              }`} />

              <div className="relative z-10 flex flex-col items-center text-center">
                {/* Chapter number badge */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                  isSelected
                    ? 'bg-gradient-to-br from-blue-100 to-blue-200 shadow-inner'
                    : 'bg-gradient-to-br from-slate-100 to-slate-200 shadow-sm'
                }`}>
                  <span className={`text-lg font-bold ${
                    isSelected ? 'text-blue-600' : 'text-slate-700'
                  }`}>
                    {chapter.chapter_number}
                  </span>
                </div>

                {/* Chapter name */}
                <span className="text-sm font-semibold text-slate-900 leading-tight mb-1 line-clamp-2">
                  {chapter.chapter_name}
                </span>

                {/* Card count and subject */}
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs text-slate-500">
                    {chapter.flashcards.length} cards
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className={`text-xs font-medium ${
                    chapter.subject === 'Chemistry' ? 'text-blue-600' :
                    chapter.subject === 'Physics' ? 'text-purple-600' :
                    chapter.subject === 'Biology' ? 'text-emerald-600' :
                    'text-indigo-600'
                  }`}>
                    {chapter.subject}
                  </span>
                </div>
              </div>

              {/* Selection indicator */}
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2"
                >
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                    <CheckCircle className="w-3 h-3 text-white" fill="currentColor" />
                  </div>
                </motion.div>
              )}

              {/* Hover indicator */}
              {!isSelected && (
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Chapters info */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">
            <span className="font-semibold">{chapters.length} chapters</span> •{' '}
            <span>{chapters.reduce((sum, ch) => sum + ch.flashcards.length, 0)} total cards</span>
          </div>
          <div className="text-xs text-slate-500">
            NCERT Curriculum
          </div>
        </div>
      </div>
    </motion.div>
  );
}