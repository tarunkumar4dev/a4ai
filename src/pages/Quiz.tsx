// src/pages/Quiz.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/context/ThemeContext';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  SkipForward, 
  CheckCircle, 
  AlertCircle,
  Trophy,
  Moon,
  Sun,
  LayoutGrid,
  FlaskConical,
  Ruler,
  BookOpen,
  Play,
  Atom,     // Physics
  Dna,      // Biology
  Variable, // Maths
  XCircle,
  RotateCcw,
  ShieldAlert,
  Info,
  Ban
} from 'lucide-react';

// --- MOCK DATA ---
const MOCK_QUESTIONS = [
  {
    id: 1,
    question: "The correct balanced chemical equation showing exothermic reaction in which natural gas burns in air is:",
    options: [
      "CH4 + O2 → CO2 + 2H2O",
      "CH4 + 2O2 → 2CO2 + 2H2O + Energy",
      "CH4 + 2O2 → CO2 + 2H2O",
      "CH4 + 2O2 → CO2 + 2H2O + Energy"
    ],
    correctAnswer: 3 
  },
  {
    id: 2,
    question: "Which of the following is NOT a property of acids?",
    options: [
      "They turn blue litmus red",
      "They have a sour taste",
      "They feel soapy to touch",
      "They react with metals to form hydrogen gas"
    ],
    correctAnswer: 2
  },
  {
    id: 3,
    question: "The kidney in human beings is a part of the system for:",
    options: [
      "Nutrition",
      "Respiration",
      "Excretion",
      "Transportation"
    ],
    correctAnswer: 2
  },
  {
    id: 4,
    question: "The autotrophic mode of nutrition requires:",
    options: [
      "Carbon dioxide and water",
      "Chlorophyll",
      "Sunlight",
      "All of the above"
    ],
    correctAnswer: 3
  }
];

// --- CONSTANTS ---
const MAX_ATTEMPTS = 2;
const MAX_WARNINGS = 3;
const QUIZ_DURATION = 45 * 60; // 45 minutes in seconds

// --- DATA STRUCTURE FOR CLASSES (SOLID COLORS) ---
const CLASS_OPTIONS = [
    { 
        id: '9', 
        label: 'Class 9', 
        sub: 'Science & Maths', 
        color: 'bg-sky-500', 
        gradient: 'from-sky-400 to-sky-600', 
        icon: FlaskConical 
    },
    { 
        id: '10', 
        label: 'Class 10', 
        sub: 'Science & Maths', 
        color: 'bg-yellow-500', 
        gradient: 'from-yellow-400 to-yellow-600', 
        icon: Atom 
    },
    { 
        id: '11', 
        label: 'Class 11', 
        sub: 'PCMB Stream', 
        color: 'bg-green-600', 
        gradient: 'from-green-500 to-green-700', 
        icon: Dna 
    },
    { 
        id: '12', 
        label: 'Class 12', 
        sub: 'PCMB Stream', 
        color: 'bg-red-600', 
        gradient: 'from-red-500 to-red-700', 
        icon: BookOpen 
    },
];

const SUBJECT_OPTIONS: Record<string, { id: string, label: string, icon: any, color: string }[]> = {
    '9': [
        { id: 'Maths', label: 'Mathematics', icon: Ruler, color: 'from-orange-400 to-orange-600' },
        { id: 'Science', label: 'Science', icon: FlaskConical, color: 'from-emerald-400 to-emerald-600' }
    ],
    '10': [
        { id: 'Maths', label: 'Mathematics', icon: Ruler, color: 'from-orange-400 to-orange-600' },
        { id: 'Science', label: 'Science', icon: FlaskConical, color: 'from-emerald-400 to-emerald-600' }
    ],
    '11': [
        { id: 'Physics', label: 'Physics', icon: Atom, color: 'from-blue-400 to-blue-600' },
        { id: 'Chemistry', label: 'Chemistry', icon: FlaskConical, color: 'from-cyan-400 to-cyan-600' },
        { id: 'Maths', label: 'Mathematics', icon: Variable, color: 'from-orange-400 to-orange-600' },
        { id: 'Biology', label: 'Biology', icon: Dna, color: 'from-rose-400 to-rose-600' }
    ],
    '12': [
        { id: 'Physics', label: 'Physics', icon: Atom, color: 'from-blue-400 to-blue-600' },
        { id: 'Chemistry', label: 'Chemistry', icon: FlaskConical, color: 'from-cyan-400 to-cyan-600' },
        { id: 'Maths', label: 'Mathematics', icon: Variable, color: 'from-orange-400 to-orange-600' },
        { id: 'Biology', label: 'Biology', icon: Dna, color: 'from-rose-400 to-rose-600' }
    ]
};

// --- REUSABLE COMPONENT: GLOSSY BUTTON ---
const GlossyButton = ({
  label,
  icon: Icon,
  variant = "purple",
  onClick,
  disabled = false,
  fullWidth = false,
  className = ""
}: any) => {
  const variants = {
    purple: "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/30 border border-white/20",
    red: "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/30 border border-white/20",
    blue: "bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/30 border border-white/20",
    green: "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-green-500/30 border border-white/20",
    outline: "bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-purple-500 dark:hover:border-purple-400",
    ghost: "bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
  };

  const styleClass = variants[variant as keyof typeof variants] || variants.purple;

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      onClick={onClick}
      disabled={disabled}
      className={`relative flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold transition-all ${styleClass} ${fullWidth ? 'w-full' : ''} ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''} ${className}`}
    >
      {Icon && <Icon size={20} />}
      {label}
    </motion.button>
  );
};

// --- ANIMATED BACKGROUND ---
const AnimatedBackground = () => (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
       <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-500/20 rounded-full blur-[100px] animate-pulse" />
       <div className="absolute bottom-[10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/20 rounded-full blur-[100px] animate-pulse delay-1000" />
       <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] bg-pink-500/20 rounded-full blur-[120px] animate-pulse delay-700" />
    </div>
  );

// --- SOLID GLOSSY CONTAINER STYLE ---
const solidGlossyClass = "flex items-center gap-2 px-6 py-2.5 rounded-2xl font-mono font-bold border-t border-white/50 shadow-lg bg-gradient-to-b from-slate-100 to-slate-200 text-slate-700 dark:from-slate-700 dark:to-slate-800 dark:text-white dark:border-slate-600 transition-all hover:scale-105 active:scale-95";

export default function Quiz() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  // --- STATES ---
  const [gameState, setGameState] = useState<'selection' | 'instructions' | 'playing' | 'result' | 'analysis' | 'disqualified'>('selection');
  
  // Selection State
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedMedium, setSelectedMedium] = useState<'English' | 'Hindi'>('English');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  
  // Quiz State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{[key: number]: number}>({});
  const [timeLeft, setTimeLeft] = useState(QUIZ_DURATION); 
  const [isPaused, setIsPaused] = useState(false);
  
  // Anti-Cheat State
  const [warningCount, setWarningCount] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  
  // Logic helpers
  const currentQuestion = MOCK_QUESTIONS[currentQuestionIndex];
  const progressPercentage = ((currentQuestionIndex) / MOCK_QUESTIONS.length) * 100;

  // --- INIT ---
  useEffect(() => {
    const today = new Date().toDateString();
    const storageKey = `quiz_attempts_${today}`;
    const used = parseInt(localStorage.getItem(storageKey) || '0');
    setAttemptsUsed(used);
  }, []);

  // --- TIMER EFFECT ---
  useEffect(() => {
    if (gameState !== 'playing' || isPaused) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleFinishQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, isPaused]);

  // --- ANTI-CHEAT LISTENERS ---
  useEffect(() => {
    if (gameState !== 'playing') return;

    const handleVisibilityChange = () => {
        if (document.hidden) {
            const newCount = warningCount + 1;
            setWarningCount(newCount);
            
            if (newCount > MAX_WARNINGS) {
                setGameState('disqualified');
            } else {
                setShowWarningModal(true);
            }
        }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [gameState, warningCount]);

  // --- FORMAT TIME ---
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- HANDLERS ---
  const handleProceedToInstructions = () => {
    if (attemptsUsed >= MAX_ATTEMPTS) {
        alert(`You have reached the limit of ${MAX_ATTEMPTS} attempts for today. Come back tomorrow!`);
        return;
    }
    setGameState('instructions');
  };

  const handleStartQuiz = () => {
    setGameState('playing');
  };

  const handleOptionSelect = (optionIndex: number) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: optionIndex
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < MOCK_QUESTIONS.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      handleFinishQuiz();
    }
  };

  const handleSkip = () => {
    if (answers[currentQuestionIndex] === undefined) {
      setAnswers(prev => ({ ...prev, [currentQuestionIndex]: -1 }));
    }
    handleNext();
  };

  const handleFinishQuiz = () => {
    setGameState('result');
    const today = new Date().toDateString();
    const storageKey = `quiz_attempts_${today}`;
    const newCount = attemptsUsed + 1;
    localStorage.setItem(storageKey, newCount.toString());
    setAttemptsUsed(newCount);
  };

  const calculateScore = () => {
    let score = 0;
    MOCK_QUESTIONS.forEach((q, idx) => {
      if (answers[idx] === q.correctAnswer) score++;
    });
    return score;
  };

  // --- RENDER HELPERS ---
  
  // 1. SELECTION SCREEN
  const renderSelectionScreen = () => (
    <div className="max-w-6xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="p-3 rounded-full bg-white dark:bg-slate-800 shadow-sm hover:scale-110 transition-transform">
            <ChevronLeft className="text-slate-600 dark:text-slate-300" />
            </button>
            <div>
                <h1 className="text-3xl font-black text-slate-800 dark:text-white">Quiz</h1>
                <p className="text-slate-500 text-sm">Dashboard / Quiz</p>
            </div>
        </div>
        
        <div className="flex items-center gap-3">
            <div className={`px-4 py-2.5 rounded-xl font-bold text-sm border flex items-center gap-2 shadow-lg text-white transition-all ${
                attemptsUsed >= MAX_ATTEMPTS 
                ? "bg-gradient-to-b from-red-500 to-red-700 border-red-400/50" 
                : "bg-gradient-to-b from-green-500 to-green-700 border-green-400/50"
            }`}>
                {attemptsUsed >= MAX_ATTEMPTS ? <XCircle size={16} className="text-white"/> : <CheckCircle size={16} className="text-white"/>}
                Attempts: {attemptsUsed}/{MAX_ATTEMPTS}
            </div>

            <button onClick={toggleTheme} className={`p-2.5 ${solidGlossyClass.replace('px-6', 'px-3')}`}>
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
             
             <div className="flex items-center gap-2 bg-gradient-to-b from-yellow-400 to-yellow-600 text-white px-4 py-2.5 rounded-xl font-bold border border-yellow-300/50 shadow-lg">
                <Trophy size={16} /> 0 Coins
            </div>
        </div>
      </div>

      <div className="text-center mb-12">
        <h2 className="text-4xl font-black text-slate-800 dark:text-white mb-3">Quiz Challenge</h2>
      </div>

      {/* Select Class */}
      <div className="mb-12">
        <h3 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-200 mb-6">
          <LayoutGrid size={24} className="text-blue-500" /> Select Your Class
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {CLASS_OPTIONS.map((item) => (
            <motion.div
              key={item.id}
              whileHover={{ scale: 1.03, y: -5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                  setSelectedClass(item.id);
                  setSelectedSubject(null); 
              }}
              className={`relative cursor-pointer rounded-3xl h-40 flex flex-col items-center justify-center text-center p-4 shadow-xl overflow-hidden transition-all border-4 ${selectedClass === item.id ? 'border-slate-800 dark:border-white ring-4 ring-slate-400/20' : 'border-transparent'}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-90`} />
              
              <div className="relative z-10 text-white flex flex-col items-center gap-2">
                <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                    <item.icon size={32} className="text-white" />
                </div>
                <div>
                    <h4 className="text-2xl font-bold">{item.label}</h4>
                    <p className="text-white/80 text-xs font-medium uppercase tracking-wider">{item.sub}</p>
                </div>
              </div>

              {selectedClass === item.id && (
                <div className="absolute top-3 right-3 bg-white text-slate-800 rounded-full p-1 shadow-sm z-20">
                  <CheckCircle size={18} fill="currentColor" className="text-slate-800 bg-white rounded-full" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedClass && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
             
             {/* Medium Selection */}
             <div className="mb-10 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-4">Select Medium</h3>
                <div className="flex gap-4">
                    {['English', 'Hindi'].map((med) => (
                        <button
                            key={med}
                            onClick={() => setSelectedMedium(med as any)}
                            className={`flex-1 px-6 py-3 rounded-2xl border-2 font-bold transition-all ${
                                selectedMedium === med 
                                ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' 
                                : 'bg-transparent text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                            }`}
                        >
                            {med}
                        </button>
                    ))}
                </div>
             </div>

            {/* Subject Selection */}
            <h3 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-200 mb-6">
              <BookOpen size={24} className="text-green-500" /> Select Subject
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-24">
              {SUBJECT_OPTIONS[selectedClass]?.map((sub) => (
                  <motion.div
                    key={sub.id}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedSubject(sub.id)}
                    className={`cursor-pointer rounded-3xl p-6 h-32 flex items-center justify-between bg-gradient-to-r ${sub.color} text-white shadow-lg relative overflow-hidden border-4 ${selectedSubject === sub.id ? 'border-slate-800 dark:border-white' : 'border-transparent'}`}
                  >
                     <sub.icon size={80} className="absolute -right-6 -bottom-6 text-white/20 rotate-12" />
                     <div className="relative z-10">
                        <h4 className="text-xl font-bold">{sub.label}</h4>
                        <p className="text-white/80 text-xs mt-1">Class {selectedClass}</p>
                     </div>
                     {selectedSubject === sub.id && <CheckCircle className="relative z-10" />}
                  </motion.div>
              ))}
            </div>

            {/* Proceed Button */}
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-700 z-50 flex justify-center">
                <GlossyButton 
                    label={attemptsUsed >= MAX_ATTEMPTS ? `Daily limit reached` : `Proceed to Instructions`}
                    variant={attemptsUsed >= MAX_ATTEMPTS ? "ghost" : "purple"} 
                    icon={ChevronRight} 
                    fullWidth={false}
                    className="w-full max-w-xl shadow-2xl"
                    onClick={handleProceedToInstructions}
                    disabled={!selectedSubject || attemptsUsed >= MAX_ATTEMPTS}
                />
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // 1.5. INSTRUCTION SCREEN (NEW)
  const renderInstructions = () => (
    <div className="max-w-4xl mx-auto py-12 px-4 flex flex-col items-center min-h-screen relative z-10">
        <div className="w-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-[32px] p-8 md:p-12 shadow-2xl border border-white/40 dark:border-white/10 animate-in zoom-in duration-300">
            
            <div className="text-center mb-8">
                <div className="inline-flex p-4 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 mb-4 shadow-lg">
                    <Info size={40} />
                </div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Quiz Instructions</h1>
                <p className="text-slate-500 dark:text-slate-300">Please read the rules carefully before starting.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 mb-10">
                {/* DO's */}
                <div className="p-6 rounded-3xl bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30">
                    <h3 className="flex items-center gap-2 font-bold text-green-700 dark:text-green-400 mb-4 text-lg">
                        <CheckCircle size={20}/> Do's
                    </h3>
                    <ul className="space-y-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <li className="flex gap-2"><span>•</span> <span>Ensure you have a stable internet connection.</span></li>
                        <li className="flex gap-2"><span>•</span> <span>Read every question carefully before answering.</span></li>
                        <li className="flex gap-2"><span>•</span> <span>Manage your time wisely (45 Minutes total).</span></li>
                        <li className="flex gap-2"><span>•</span> <span>Submit the quiz before the timer runs out.</span></li>
                    </ul>
                </div>

                {/* DON'Ts */}
                <div className="p-6 rounded-3xl bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30">
                    <h3 className="flex items-center gap-2 font-bold text-red-600 dark:text-red-400 mb-4 text-lg">
                        <XCircle size={20}/> Don'ts
                    </h3>
                    <ul className="space-y-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <li className="flex gap-2"><span>•</span> <span>Do not refresh the page during the quiz.</span></li>
                        <li className="flex gap-2"><span>•</span> <span>Do not switch tabs or open other applications.</span></li>
                        <li className="flex gap-2"><span>•</span> <span>Do not use the back button on your browser.</span></li>
                    </ul>
                </div>
            </div>

            {/* CRITICAL WARNING CARD */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-red-500 to-red-700 text-white shadow-xl shadow-red-500/20 mb-10 border border-red-400/50 relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
                    <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm shrink-0">
                        <ShieldAlert size={32} className="animate-pulse" />
                    </div>
                    <div>
                        <h4 className="text-xl font-bold mb-1">Strict Anti-Cheating Policy</h4>
                        <p className="text-white/90 text-sm">
                            Switching tabs or minimizing the app is monitored. 
                            <span className="font-black text-yellow-300 block mt-1 text-base">
                                You have 3 Warnings allowed. On the 4th attempt, the test will be immediately CANCELLED.
                            </span>
                        </p>
                    </div>
                </div>
                {/* Decor */}
                <div className="absolute top-[-50%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"/>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <GlossyButton 
                    label="Back" 
                    variant="outline" 
                    icon={ChevronLeft} 
                    onClick={() => setGameState('selection')}
                />
                <GlossyButton 
                    label="I Understand, Start Quiz" 
                    variant="purple" 
                    icon={Play} 
                    className="w-full sm:w-auto shadow-purple-500/40"
                    onClick={handleStartQuiz}
                />
            </div>

        </div>
    </div>
  );

  // 1.7. DISQUALIFIED SCREEN
  const renderDisqualifiedScreen = () => (
    <div className="max-w-2xl mx-auto py-20 px-4 flex flex-col items-center min-h-screen relative z-10 text-center animate-in zoom-in duration-300">
        <div className="p-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 mb-6 animate-bounce">
            <Ban size={64} />
        </div>
        <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-4">Test Terminated</h1>
        <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 max-w-md mx-auto">
            You have exceeded the maximum number of tab switch warnings. As per our anti-cheating policy, your test has been cancelled automatically.
        </p>
        <GlossyButton 
            label="Return to Dashboard" 
            variant="red" 
            icon={LayoutGrid} 
            onClick={() => navigate('/dashboard')}
        />
    </div>
  );

  // 2. PLAYING SCREEN
  const renderPlayingScreen = () => (
    <div className="relative z-10 max-w-5xl mx-auto py-6 px-4 flex flex-col min-h-screen">
      
      {/* WARNING MODAL */}
      <AnimatePresence>
        {showWarningModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="bg-gradient-to-br from-red-600 to-red-800 text-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center border-2 border-red-400"
                >
                    <ShieldAlert size={48} className="mx-auto mb-4 text-yellow-300 animate-pulse" />
                    <h2 className="text-2xl font-black mb-2">Warning Issued!</h2>
                    <p className="mb-6 text-white/90">
                        You switched tabs or minimized the window. This is prohibited.
                    </p>
                    <div className="bg-black/20 rounded-xl p-3 mb-6 font-mono font-bold text-xl">
                        Warning {warningCount}/{MAX_WARNINGS}
                    </div>
                    <button 
                        onClick={() => setShowWarningModal(false)}
                        className="w-full py-3 bg-white text-red-700 font-bold rounded-xl hover:bg-red-50 transition-colors"
                    >
                        I Understand
                    </button>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* Top Bar - Glassy */}
      <header className="flex items-center justify-between mb-8 backdrop-blur-xl bg-white/40 dark:bg-black/40 p-3 rounded-2xl border border-white/20 shadow-sm sticky top-4 z-50">
        <button 
            onClick={() => { if(confirm("Quit?")) navigate('/dashboard'); }} 
            className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-bold px-4 py-2 rounded-xl hover:bg-white/20 transition-all"
        >
            <ChevronLeft size={20} /> <span className="hidden sm:inline">Quit</span>
        </button>

        <div className="flex items-center gap-4">
            {/* TIMER BUTTON */}
            <div className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl font-mono font-bold border-t border-white/50 shadow-lg ${
                timeLeft < 300 
                ? 'bg-gradient-to-b from-red-500 to-red-600 text-white animate-pulse' 
                : 'bg-gradient-to-b from-slate-100 to-slate-200 text-slate-700 dark:from-slate-700 dark:to-slate-800 dark:text-white dark:border-slate-600'
            }`}>
                <Clock size={18} /> {formatTime(timeLeft)}
            </div>
            
            {/* DARK MODE */}
            <button onClick={toggleTheme} className={`p-2.5 ${solidGlossyClass.replace('px-6', 'px-3')}`}>
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
        </div>
      </header>

      {/* Progress */}
      <div className="mb-6 px-2">
          <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
              <span>Progress</span>
              <span>{Math.round(progressPercentage)}%</span>
          </div>
          <div className="w-full h-4 bg-white/30 dark:bg-black/30 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
            <motion.div 
                className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.5 }}
            />
          </div>
      </div>

      {/* Question Card */}
      <AnimatePresence mode='wait'>
        <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-[32px] p-6 md:p-10 shadow-2xl border border-white/40 dark:border-white/10 flex-1 flex flex-col"
        >
            <div className="mb-6 flex justify-between items-start">
                <span className="text-[10px] font-black bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg shadow-blue-500/30">
                    Question {currentQuestionIndex + 1}
                </span>
                <span className="text-slate-400 text-xs font-bold uppercase">{selectedSubject}</span>
            </div>

            <h2 className="text-xl md:text-3xl font-bold text-slate-800 dark:text-white mb-10 leading-snug">
                {currentQuestion.question}
            </h2>

            <div className="grid gap-4">
                {currentQuestion.options.map((opt, idx) => {
                    const isSelected = answers[currentQuestionIndex] === idx;
                    return (
                        <button
                            key={idx}
                            onClick={() => handleOptionSelect(idx)}
                            className={`
                                group relative flex items-center gap-5 p-5 rounded-2xl text-left transition-all duration-300 border
                                ${isSelected 
                                    ? 'bg-purple-600/90 border-purple-500 text-white shadow-xl shadow-purple-500/30 scale-[1.01]' 
                                    : 'bg-white/40 dark:bg-black/20 border-white/20 hover:bg-white/60 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 hover:border-purple-300'
                                }
                            `}
                        >
                            <div className={`
                                w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors
                                ${isSelected ? 'bg-white/20 text-white' : 'bg-black/5 dark:bg-white/10 text-slate-500'}
                            `}>
                                {String.fromCharCode(65 + idx)}
                            </div>
                            <span className="font-semibold text-lg">{opt}</span>
                            {isSelected && <div className="ml-auto"><CheckCircle className="text-white"/></div>}
                        </button>
                    )
                })}
            </div>
        </motion.div>
      </AnimatePresence>

      {/* Action Bar */}
      <div className="mt-8 flex items-center justify-between gap-4">
        
        {/* SKIP BUTTON */}
        <button 
            onClick={handleSkip}
            className={`${solidGlossyClass} text-sm`}
        >
            <SkipForward size={18} /> Skip
        </button>

        <button 
            onClick={handleNext}
            disabled={answers[currentQuestionIndex] === undefined}
            className={`
                px-10 py-4 rounded-2xl font-bold text-lg shadow-xl transition-all flex items-center gap-3
                ${answers[currentQuestionIndex] === undefined 
                    ? 'bg-slate-200/50 text-slate-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:scale-105 active:scale-95 shadow-purple-500/30'
                }
            `}
        >
            <span>{currentQuestionIndex === MOCK_QUESTIONS.length - 1 ? "Finish" : "Next"}</span>
            {currentQuestionIndex === MOCK_QUESTIONS.length - 1 ? <CheckCircle size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>

    </div>
  );

  // 3. ANALYSIS COMPONENT
  const renderAnalysis = (score: number, total: number) => {
    return (
        <div className="w-full mt-8 animate-in slide-in-from-bottom-10 fade-in duration-700">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                <AlertCircle className="text-blue-500" /> Detailed Analysis
            </h3>
            
            <div className="space-y-4">
                {MOCK_QUESTIONS.map((q, idx) => {
                    const userAnswer = answers[idx];
                    const isCorrect = userAnswer === q.correctAnswer;
                    const isSkipped = userAnswer === -1 || userAnswer === undefined;

                    return (
                        <div key={idx} className={`p-4 rounded-2xl border-l-4 ${isCorrect ? 'bg-green-50 border-green-500 dark:bg-green-900/10' : isSkipped ? 'bg-yellow-50 border-yellow-500 dark:bg-yellow-900/10' : 'bg-red-50 border-red-500 dark:bg-red-900/10'} shadow-sm bg-white dark:bg-slate-800`}>
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-slate-700 dark:text-slate-300">Q{idx+1}.</span>
                                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isCorrect ? 'bg-green-200 text-green-800' : isSkipped ? 'bg-yellow-200 text-yellow-800' : 'bg-red-200 text-red-800'}`}>
                                    {isCorrect ? 'Correct' : isSkipped ? 'Skipped' : 'Incorrect'}
                                </span>
                            </div>
                            <p className="text-slate-800 dark:text-slate-200 font-medium mb-3">{q.question}</p>
                            
                            <div className="text-sm space-y-1">
                                {!isSkipped && (
                                    <p className={`${isCorrect ? 'text-green-700' : 'text-red-600'}`}>
                                        <span className="font-bold">Your Answer:</span> {q.options[userAnswer]}
                                    </p>
                                )}
                                {!isCorrect && (
                                    <p className="text-green-600 dark:text-green-400">
                                        <span className="font-bold">Correct Answer:</span> {q.options[q.correctAnswer]}
                                    </p>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
  }

  // 4. RESULT SCREEN
  const renderResultScreen = () => {
    const score = calculateScore();
    const total = MOCK_QUESTIONS.length;
    const percentage = (score / total) * 100;
    
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 flex flex-col items-center min-h-screen animate-in zoom-in duration-500 relative z-10">
        
        {/* Toggle Dark Mode in Result */}
        <div className="absolute top-6 right-6">
            <button onClick={toggleTheme} className="p-3 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
        </div>

        <div className="relative mb-6">
            <div className="absolute inset-0 bg-yellow-400 blur-3xl opacity-20 rounded-full" />
            <Trophy size={100} className="text-yellow-500 relative z-10 drop-shadow-2xl animate-bounce" />
        </div>

        <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">Quiz Completed!</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">You have successfully finished the {selectedSubject} quiz.</p>

        {/* Score Card */}
        <div className="w-full bg-white dark:bg-slate-800 rounded-[2rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-700 mb-8 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-3 ${percentage > 70 ? 'bg-green-500' : percentage > 40 ? 'bg-yellow-500' : 'bg-red-500'}`} />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-700">
                <div className="flex flex-col items-center py-2">
                    <span className="text-xs uppercase font-bold text-slate-400 tracking-widest">Score</span>
                    <span className="text-5xl font-black text-slate-800 dark:text-white mt-2">{score}<span className="text-2xl text-slate-400">/{total}</span></span>
                </div>
                
                <div className="flex flex-col items-center py-2">
                    <span className="text-xs uppercase font-bold text-slate-400 tracking-widest">Accuracy</span>
                    <span className={`text-4xl font-bold mt-2 ${percentage > 70 ? 'text-green-500' : percentage > 40 ? 'text-orange-500' : 'text-red-500'}`}>{Math.round(percentage)}%</span>
                </div>

                <div className="flex flex-col items-center py-2">
                    <span className="text-xs uppercase font-bold text-slate-400 tracking-widest">Coins</span>
                    <p className="text-sm font-bold mt-2 text-yellow-600 dark:text-yellow-400 text-center px-4 leading-tight">Take part in more quiz to earn Coins</p>
                </div>
            </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center mb-12">
            <GlossyButton 
                label={gameState === 'analysis' ? "Hide Analysis" : "View Detailed Analysis"} 
                variant="outline" 
                icon={AlertCircle}
                onClick={() => setGameState(gameState === 'analysis' ? 'result' : 'analysis')}
            />
            <GlossyButton 
                label="Return to Dashboard" 
                variant="purple" 
                icon={LayoutGrid}
                onClick={() => navigate('/dashboard')}
            />
        </div>

        {/* Render Analysis if toggled */}
        {gameState === 'analysis' && renderAnalysis(score, total)}

      </div>
    );
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-[#F8F9FC] text-slate-800'} relative overflow-x-hidden`}>
      
      {/* GLOBAL COLORFUL ANIMATED BACKGROUND */}
      <AnimatedBackground />

      {/* CONTENT */}
      {(gameState === 'selection') && renderSelectionScreen()}
      {(gameState === 'instructions') && renderInstructions()}
      {gameState === 'playing' && renderPlayingScreen()}
      {(gameState === 'result' || gameState === 'analysis') && renderResultScreen()}
      {(gameState === 'disqualified') && renderDisqualifiedScreen()}

    </div>
  );
}
