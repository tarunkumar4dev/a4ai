import React from 'react';
import { motion } from 'framer-motion';
import { FlashcardProvider } from '@/context/FlashcardContext';
import { useFlashcards } from '@/context/FlashcardContext';
import ClassSelector from '@/components/flashcards/ClassSelector';
import SubjectSelector from '@/components/flashcards/SubjectSelector';
import ChapterSelector from '@/components/flashcards/ChapterSelector';
import FlashcardDeck from '@/components/flashcards/FlashcardDeck';
import { BookOpen, Zap, Target, Users, Trophy } from 'lucide-react';

// Main content component (separated for clarity)
function FlashcardContent() {
  const {
    selectedClass,
    selectedSubject,
    selectedChapter,
    currentDeck,
    masteredCards,
    progress,
    selectClass,
    selectSubject,
    selectChapter,
    markAsMastered,
    saveNotes,
    getAvailableChapters,
    getDeckTitle,
    getDeckSubtitle
  } = useFlashcards();

  const availableChapters = getAvailableChapters();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <BookOpen className="text-white" size={24} />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                    a4ai Flashcards
                  </h1>
                  <p className="text-sm text-slate-600">Think Beyond • Learn concepts in small, focused cards</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 border border-slate-200 shadow-sm">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
                  <span className="text-sm font-semibold text-slate-700">Designed for Classes 9–12</span>
                </div>
                <button className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all hover:shadow-lg">
                  Student Mode
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 text-center"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Master Concepts with{' '}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Smart Flashcards
              </span>
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-8">
              Interactive learning with NCERT-aligned flashcards. Track progress, take notes, and study smarter.
            </p>
            
            <div className="flex flex-wrap justify-center gap-6">
              <div className="flex items-center gap-2 text-slate-700">
                <Zap className="text-blue-500" size={20} />
                <span className="font-medium">Active Recall</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Target className="text-emerald-500" size={20} />
                <span className="font-medium">Progress Tracking</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Users className="text-purple-500" size={20} />
                <span className="font-medium">Community Notes</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Trophy className="text-amber-500" size={20} />
                <span className="font-medium">Gamified Learning</span>
              </div>
            </div>
          </motion.div>

          {/* Learning Path Selection */}
          <div className="space-y-8">
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-effect rounded-3xl p-6 md:p-8"
            >
              <div className="mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
                  Select Your Learning Path
                </h2>
                <p className="text-slate-600">
                  Choose your class and subject. We'll show you focused flashcards and a notes space for that topic.
                </p>
              </div>

              {/* Class Selection */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">
                  Step 1 • Choose Class
                </h3>
                <ClassSelector
                  selectedClass={selectedClass}
                  onSelectClass={selectClass}
                />
              </div>

              {/* Subject Selection */}
              {selectedClass && (
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">
                    Step 2 • Choose Subject
                  </h3>
                  <SubjectSelector
                    selectedClass={selectedClass}
                    selectedSubject={selectedSubject}
                    onSelectSubject={selectSubject}
                  />
                </div>
              )}

              {/* Chapter Selection */}
              {selectedClass && selectedSubject && (
                <div className="mb-8">
                  <ChapterSelector
                    chapters={availableChapters}
                    selectedChapter={selectedChapter}
                    onSelectChapter={selectChapter}
                    subject={selectedSubject}
                  />
                </div>
              )}
            </motion.section>

            {/* Flashcard Deck Display */}
            {selectedClass && selectedSubject && selectedChapter && currentDeck.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <FlashcardDeck
                  deck={currentDeck}
                  deckTitle={getDeckTitle()}
                  deckSubtitle={getDeckSubtitle()}
                  onMasterCard={markAsMastered}
                  masteredCardIds={masteredCards}
                  onSaveNotes={saveNotes}
                />
              </motion.section>
            )}

            {/* Empty State */}
            {(!selectedClass || !selectedSubject || !selectedChapter) && currentDeck.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-effect rounded-3xl p-12 text-center"
              >
                <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-blue-200 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <BookOpen className="text-blue-600" size={40} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">
                  Ready to Learn?
                </h3>
                <p className="text-slate-600 max-w-md mx-auto mb-8">
                  Select your class, subject, and chapter above to start learning with interactive flashcards.
                  Track your progress and take notes as you study.
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200">
                  <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                  <span className="text-sm font-medium text-blue-700">
                    Recommended: Class 10 Science for board exams
                  </span>
                </div>
              </motion.div>
            )}
          </div>

          {/* Stats Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-16"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="glass-effect rounded-2xl p-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">500+</div>
                <div className="text-sm text-slate-600">Flashcards</div>
              </div>
              <div className="glass-effect rounded-2xl p-6 text-center">
                <div className="text-3xl font-bold text-emerald-600 mb-2">100%</div>
                <div className="text-sm text-slate-600">NCERT Aligned</div>
              </div>
              <div className="glass-effect rounded-2xl p-6 text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">4.9★</div>
                <div className="text-sm text-slate-600">Student Rating</div>
              </div>
              <div className="glass-effect rounded-2xl p-6 text-center">
                <div className="text-3xl font-bold text-amber-600 mb-2">10k+</div>
                <div className="text-sm text-slate-600">Active Learners</div>
              </div>
            </div>
          </motion.div>
        </main>

        {/* Footer */}
        <footer className="mt-12 py-6 text-center border-t border-slate-200">
          <div className="container mx-auto px-4">
            <p className="text-sm text-slate-500">
              Made with ❤️ for students • a4ai — Think Beyond
            </p>
            <div className="flex justify-center gap-4 mt-3 text-xs text-slate-400">
              <span>© 2024 a4ai</span>
              <span>•</span>
              <span>Privacy Policy</span>
              <span>•</span>
              <span>Terms of Service</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// Main Dashboard Component
export default function FlashcardDashboard() {
  return (
    <FlashcardProvider>
      <FlashcardContent />
    </FlashcardProvider>
  );
}