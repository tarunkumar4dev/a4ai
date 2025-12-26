import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FlashcardProvider } from '@/context/FlashcardContext';
import { useFlashcards } from '@/context/FlashcardContext';
import FlashcardDeck from '@/components/flashcards/FlashcardDeck';
import { ArrowLeft, BookOpen, Home, Share2, Download } from 'lucide-react';

export default function FlashcardChapter() {
  const { subject, chapter } = useParams<{ subject: string; chapter: string }>();
  const navigate = useNavigate();
  const chapterNumber = chapter ? parseInt(chapter) : null;

  return (
    <FlashcardProvider>
      <FlashcardChapterContent 
        subject={subject || ''} 
        chapterNumber={chapterNumber} 
        onBack={() => navigate('/dashboard/flashcards')} 
      />
    </FlashcardProvider>
  );
}

interface FlashcardChapterContentProps {
  subject: string;
  chapterNumber: number | null;
  onBack: () => void;
}

function FlashcardChapterContent({ subject, chapterNumber, onBack }: FlashcardChapterContentProps) {
  const {
    currentDeck,
    masteredCards,
    markAsMastered,
    saveNotes,
    getDeckTitle,
    getDeckSubtitle
  } = useFlashcards();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft size={18} />
                <span className="font-medium">Back to Selection</span>
              </button>
              
              <div className="h-8 w-px bg-slate-200"></div>
              
              <div>
                <h1 className="text-xl font-bold text-slate-900">{getDeckTitle()}</h1>
                <p className="text-sm text-slate-600">{getDeckSubtitle()}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                <Share2 size={18} className="text-slate-600" />
              </button>
              <button className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                <Download size={18} className="text-slate-600" />
              </button>
              <button
                onClick={() => navigate('/dashboard/flashcards')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-600 hover:to-blue-700 transition-all"
              >
                <Home size={18} />
                <span>Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Chapter Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-effect rounded-3xl p-6 mb-8"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <BookOpen className="text-white" size={20} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{getDeckTitle()}</h2>
                  <p className="text-slate-600">{getDeckSubtitle()}</p>
                </div>
              </div>
              
              <div className="mt-4 flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-900">{currentDeck.length}</div>
                  <div className="text-sm text-slate-500">Total Cards</div>
                </div>
                <div className="h-8 w-px bg-slate-200"></div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600">{masteredCards.size}</div>
                  <div className="text-sm text-slate-500">Mastered</div>
                </div>
                <div className="h-8 w-px bg-slate-200"></div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {currentDeck.length > 0 
                      ? Math.round((masteredCards.size / currentDeck.length) * 100)
                      : 0}%
                  </div>
                  <div className="text-sm text-slate-500">Progress</div>
                </div>
              </div>
            </div>

            <div className="hidden md:block">
              <div className="text-right">
                <div className="text-sm text-slate-500 mb-1">NCERT Chapter</div>
                <div className="text-lg font-bold text-slate-900">Chapter {chapterNumber}</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Flashcard Deck */}
        {currentDeck.length > 0 ? (
          <FlashcardDeck
            deck={currentDeck}
            deckTitle={getDeckTitle()}
            deckSubtitle={getDeckSubtitle()}
            onMasterCard={markAsMastered}
            masteredCardIds={masteredCards}
            onSaveNotes={saveNotes}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-effect rounded-3xl p-12 text-center"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <BookOpen className="text-blue-600" size={32} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">
              No Flashcards Available
            </h3>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              There are no flashcards available for this chapter yet.
            </p>
            <button
              onClick={onBack}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all hover:shadow-lg"
            >
              Choose Another Chapter
            </button>
          </motion.div>
        )}
      </main>
    </div>
  );
}