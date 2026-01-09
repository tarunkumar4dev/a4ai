import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FlashcardProvider } from '@/context/FlashcardContext';
import { useFlashcards } from '@/context/FlashcardContext';
import ChapterSelector from '@/components/flashcards/ChapterSelector';
import { ArrowLeft, BookOpen, Home, ChevronRight } from 'lucide-react';

export default function FlashcardSubject() {
  const { class: classParam, subject } = useParams<{ class: string; subject: string }>();
  const navigate = useNavigate();
  const classNum = classParam ? parseInt(classParam) : null;

  return (
    <FlashcardProvider 
      initialClass={classNum ?? undefined}
      initialSubject={subject || undefined}
    >
      <FlashcardSubjectContent 
        classNum={classNum} 
        subject={subject || ''} 
        onBack={() => navigate('/dashboard/flashcards')} 
      />
    </FlashcardProvider>
  );
}

interface FlashcardSubjectContentProps {
  classNum: number | null;
  subject: string;
  onBack: () => void;
}

function FlashcardSubjectContent({ classNum, subject, onBack }: FlashcardSubjectContentProps) {
  const {
    selectedChapter,
    selectChapter,
    getAvailableChapters
  } = useFlashcards();

  const chapters = getAvailableChapters();
  const totalCards = chapters.reduce((sum, ch) => sum + ch.flashcards.length, 0);

  const getSubjectColor = (subject: string) => {
    const colors: Record<string, string> = {
      Science: 'from-blue-500 to-cyan-500',
      Mathematics: 'from-purple-500 to-pink-500',
      Chemistry: 'from-blue-500 to-indigo-500',
      Physics: 'from-purple-500 to-violet-500',
      Biology: 'from-emerald-500 to-green-500'
    };
    return colors[subject] || 'from-slate-500 to-slate-600';
  };

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
                <span className="font-medium">Back to Subjects</span>
              </button>
              
              <div className="h-8 w-px bg-slate-200"></div>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium">Class {classNum}</span>
                  <ChevronRight size={16} />
                  <span className="font-bold bg-gradient-to-r bg-clip-text text-transparent" style={{ 
                    backgroundImage: `linear-gradient(to right, ${getSubjectColor(subject)})`
                  }}>
                    {subject}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
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
        {/* Subject Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-effect rounded-3xl p-8 mb-8"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getSubjectColor(subject)} flex items-center justify-center`}>
                  <BookOpen className="text-white" size={28} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">{subject}</h1>
                  <p className="text-slate-600">Class {classNum} • Complete NCERT Coverage</p>
                </div>
              </div>
              
              <div className="flex items-center gap-6 mt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-900">{chapters.length}</div>
                  <div className="text-sm text-slate-500">Chapters</div>
                </div>
                <div className="h-8 w-px bg-slate-200"></div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-900">{totalCards}</div>
                  <div className="text-sm text-slate-500">Total Cards</div>
                </div>
                <div className="h-8 w-px bg-slate-200"></div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-900">100%</div>
                  <div className="text-sm text-slate-500">NCERT Aligned</div>
                </div>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="text-right">
                <div className="text-sm text-slate-500 mb-2">Learning Path</div>
                <div className="flex items-center gap-2 text-slate-700">
                  <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    Class {classNum}
                  </div>
                  <ChevronRight size={16} />
                  <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {subject}
                  </div>
                  <ChevronRight size={16} />
                  <div className="px-3 py-1 bg-blue-500 text-white rounded-full text-sm font-medium">
                    Chapter
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Chapter Selection */}
        <ChapterSelector
          chapters={chapters}
          selectedChapter={selectedChapter}
          onSelectChapter={(chapterNum) => {
            selectChapter(chapterNum);
            // Navigate to chapter page with class in state
            navigate(`/dashboard/flashcards/${subject}/${chapterNum}`, {
              state: { class: classNum }
            });
          }}
          subject={subject}
        />

        {/* Study Tips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <div className="glass-effect rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                <div className="text-blue-600 font-bold">1</div>
              </div>
              <h3 className="font-semibold text-slate-900">Start with Basics</h3>
            </div>
            <p className="text-sm text-slate-600">
              Begin with Chapter 1 and build your foundation before moving to advanced topics.
            </p>
          </div>
          
          <div className="glass-effect rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center">
                <div className="text-emerald-600 font-bold">2</div>
              </div>
              <h3 className="font-semibold text-slate-900">Track Progress</h3>
            </div>
            <p className="text-sm text-slate-600">
              Mark cards as mastered and track your learning progress with visual indicators.
            </p>
          </div>
          
          <div className="glass-effect rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
                <div className="text-purple-600 font-bold">3</div>
              </div>
              <h3 className="font-semibold text-slate-900">Take Notes</h3>
            </div>
            <p className="text-sm text-slate-600">
              Use the notes feature to add your insights, tricks, and questions for each card.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}