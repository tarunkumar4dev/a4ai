// src/practice/index.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Award, Sparkles, BookOpen, Moon, Sun, LayoutGrid
} from 'lucide-react';
import { supabase, practiceDB } from '@/lib/supabaseClient';
import { useTheme } from '@/context/ThemeContext';

// --- IMPORTS ---
import { class10MathsData } from './data/class10Maths';
import { class10ScienceData } from './data/class10Science';

// --- GLOSSY CARD STYLE ---
const glossyCardStyle = (variant: 'blue' | 'green' | 'red' | 'yellow' | 'slate', isActive: boolean, theme: 'light' | 'dark') => {
    const baseStyle = "relative overflow-hidden rounded-[30px] p-6 transition-all duration-300 cursor-pointer border-t border-white/20 shadow-lg";
    
    const variants = {
        blue: isActive 
            ? "bg-gradient-to-br from-blue-400/90 to-blue-600/90 text-white shadow-blue-500/40 scale-[1.02]" 
            : `bg-gradient-to-br from-blue-50 to-blue-100/50 text-blue-900 ${theme === 'dark' ? 'from-slate-800 to-slate-900 text-blue-100' : ''}`,
        green: isActive 
            ? "bg-gradient-to-br from-green-400/90 to-green-600/90 text-white shadow-green-500/40 scale-[1.02]" 
            : `bg-gradient-to-br from-green-50 to-green-100/50 text-green-900 ${theme === 'dark' ? 'from-slate-800 to-slate-900 text-green-100' : ''}`,
        red: isActive 
            ? "bg-gradient-to-br from-red-500/90 to-rose-600/90 text-white shadow-red-500/40 scale-[1.02]" 
            : `bg-gradient-to-br from-red-50 to-rose-100/50 text-red-900 ${theme === 'dark' ? 'from-slate-800 to-slate-900 text-red-100' : ''}`,
        yellow: isActive 
            ? "bg-gradient-to-br from-yellow-400/90 to-orange-500/90 text-white shadow-orange-500/40 scale-[1.02]" 
            : `bg-gradient-to-br from-yellow-50 to-orange-100/50 text-orange-900 ${theme === 'dark' ? 'from-slate-800 to-slate-900 text-yellow-100' : ''}`,
        slate: isActive 
            ? `bg-slate-200 dark:bg-slate-700` 
            : `bg-slate-100 dark:bg-slate-800/50 opacity-60 hover:opacity-100`,
    };

    return `${baseStyle} ${variants[variant]}`;
};

const PracticeSelectionPage = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [userStats, setUserStats] = useState({ streak: 0, totalCoins: 0, todayAttempted: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const classes = [
    { id: '10', name: 'Class 10', icon: '🔬', variant: 'blue' as const },
    { id: '12', name: 'Class 12', icon: '📚', variant: 'red' as const }
  ];

  const subjects = {
    '10': [
      { id: 'science', name: 'Science', icon: '🧪', variant: 'green' as const },
      { id: 'maths', name: 'Mathematics', icon: '📐', variant: 'yellow' as const }
    ],
    '12': [
      { id: 'science', name: 'Science', icon: '⚛️', variant: 'green' as const },
      { id: 'maths', name: 'Mathematics', icon: '📊', variant: 'yellow' as const }
    ]
  };

  const chapters = Array.from({ length: 15 }, (_, i) => ({
    id: `chapter-${i + 1}`, number: i + 1, name: `Chapter ${i + 1}`, icon: '📖'
  }));

  // --- CRITICAL FIX: Use object lookup instead of hardcoded strings ---
  const getQuestionsForSelection = (cls: string, sub: string, chId: string) => {
    if (cls === '10') {
      if (sub === 'maths') {
        // @ts-ignore
        return class10MathsData[chId] || [];
      } else if (sub === 'science') {
        // Returns questions specific to the selected chapter ID
        return class10ScienceData[chId] || [];
      }
    }
    return [];
  };

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      if (user?.id) {
        const profile = await practiceDB.getUserPracticeProfile(user.id);
        setUserStats({ streak: profile?.practice_streak || 0, totalCoins: profile?.total_coins || 0, todayAttempted: 0 });
      }
      setLoading(false);
    };
    initialize();
  }, []);

  const handleChapterSelect = (chapterId: string) => {
    if (!userId) { navigate('/login?redirect=/daily-practice'); return; }

    const questions = getQuestionsForSelection(selectedClass!, selectedSubject!, chapterId);
    
    if (questions && questions.length > 0) {
      const shuffledQuestions = [...questions].sort(() => 0.5 - Math.random());
      
      navigate('/practice/session', { 
        state: { 
          classId: selectedClass, subject: selectedSubject, chapter: chapterId,
          questions: shuffledQuestions, totalQuestions: questions.length 
        }
      });
    } else {
      alert("Coming soon! No questions found for this chapter.");
    }
  };

  const getChapterName = (chapterNumber: number, subject: string) => {
    if (subject === 'science') {
      const names = ["Chemical Reactions", "Acids, Bases & Salts", "Metals & Non-Metals", "Carbon & Its Compounds", "Life Processes", "Control & Coordination", "Reproduction", "Heredity", "Light", "Human Eye"];
      return names[chapterNumber - 1] || `Chapter ${chapterNumber}`;
    } else if (subject === 'maths') {
      const names = ["Real Numbers", "Polynomials", "Linear Equations", "Quadratic Equations", "Arithmetic Progressions"];
      return names[chapterNumber - 1] || `Chapter ${chapterNumber}`;
    }
    return `Chapter ${chapterNumber}`;
  };

  const getChapterQuestionCount = (chapterNumber: number, subject: string) => {
    const chId = `chapter-${chapterNumber}`;
    const qList = getQuestionsForSelection(selectedClass || '', subject, chId);
    return qList.length > 0 ? `${qList.length} Qs` : "";
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 pb-20 ${theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-[#F0F2F5] text-slate-900'}`}>
      <div className={`sticky top-0 z-50 border-b backdrop-blur-xl ${theme === 'dark' ? 'bg-[#0f172a]/80 border-slate-700' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-[72px] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.button onClick={() => navigate(-1)} className={`w-10 h-10 flex items-center justify-center rounded-full border`}>
                <ArrowLeft size={20} />
              </motion.button>
              <h1 className="text-xl font-bold">Daily <span className="text-indigo-500">Practice</span></h1>
            </div>
            <div className="flex items-center gap-3">
               <motion.button onClick={toggleTheme} className={`p-2.5 rounded-full border`}>
                  {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
               </motion.button>
               <div className={`flex items-center gap-2 px-4 py-2 rounded-full border`}>
                <Award size={18} className="text-yellow-500" />
                <span className="font-bold">{userStats.totalCoins}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3">Practice Challenge</h1>
          <p className="text-lg opacity-70">Unlimited questions. Earn <span className="font-bold text-yellow-500">+5 coins</span> per answer.</p>
        </div>

        <div className="mb-10">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Sparkles size={20} className="text-blue-500" /> Select Your Class</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {classes.map((cls) => (
              <motion.div key={cls.id} whileHover={{ scale: 1.03 }} onClick={() => { setSelectedClass(cls.id); setSelectedSubject(null); }}
                className={glossyCardStyle(cls.variant, selectedClass === cls.id, theme)}>
                <div className="flex items-center gap-6 relative z-10">
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-5xl bg-white/20 backdrop-blur-md`}>{cls.icon}</div>
                  <div className="flex-1"><h3 className="text-2xl font-bold mb-1">{cls.name}</h3><p className="text-sm opacity-80">Science & Mathematics</p></div>
                  {selectedClass === cls.id && <div className="w-5 h-5 rounded-full bg-white shadow-lg"></div>}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {selectedClass && (
          <div className="mb-10">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><BookOpen size={20} className="text-green-500" /> Select Subject</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {subjects[selectedClass as keyof typeof subjects]?.map((subj) => (
                <motion.div key={subj.id} whileHover={{ scale: 1.03 }} onClick={() => setSelectedSubject(subj.id)}
                  className={glossyCardStyle(subj.variant, selectedSubject === subj.id, theme)}>
                  <div className="flex items-center gap-6 relative z-10">
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl bg-white/20 backdrop-blur-md`}>{subj.icon}</div>
                    <div className="flex-1"><h3 className="text-2xl font-bold mb-1">{subj.name}</h3><p className="text-sm opacity-80">Class {selectedClass} curriculum</p></div>
                    {selectedSubject === subj.id && <div className="w-5 h-5 rounded-full bg-white shadow-lg"></div>}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {selectedClass && selectedSubject && (
          <div className="mb-12">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><LayoutGrid size={20} className="text-indigo-500" /> Select Chapter</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {chapters.map((chapter) => {
                const count = getChapterQuestionCount(chapter.number, selectedSubject);
                const hasQuestions = count !== "";
                return (
                  <motion.div key={chapter.id} whileHover={hasQuestions ? { scale: 1.05 } : {}} onClick={() => hasQuestions && handleChapterSelect(chapter.id)}
                    className={glossyCardStyle('slate', false, theme) + ` flex flex-col items-center justify-center text-center p-4 ${!hasQuestions ? 'opacity-50' : 'hover:border-indigo-400'}`}>
                    <div className="text-4xl mb-3">{chapter.icon}</div>
                    <h3 className="font-bold text-sm mb-1">{getChapterName(chapter.number, selectedSubject)}</h3>
                    {hasQuestions ? <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-bold mt-2">{count}</span> : <span className="text-[10px] mt-2 opacity-60">Coming Soon</span>}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PracticeSelectionPage;
