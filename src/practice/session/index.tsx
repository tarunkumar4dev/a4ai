// src/practice/session/index.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Check, Clock, Trophy, Sparkles, ChevronRight, AlertCircle, Moon, Sun, BarChart2, CheckCircle, XCircle, Target, X
} from 'lucide-react';
import { supabase, practiceDB } from '@/lib/supabaseClient';
import { useTheme } from '@/context/ThemeContext';

import { class10MathsData } from '../data/class10Maths';
import { class10ScienceData } from '../data/class10Science';

// --- GLOSSY BUTTON (INLINE STYLES FORCED) ---
const GlossyButton = ({ icon: Icon, label, variant = "indigo", onClick, fullWidth = false, small = false, disabled = false }: any) => {
  const getGradient = () => {
    switch (variant) {
        case 'indigo': return 'linear-gradient(180deg, #6366f1 0%, #4338ca 100%)';
        case 'purple': return 'linear-gradient(180deg, #a855f7 0%, #7e22ce 100%)';
        case 'dark': return 'linear-gradient(180deg, #374151 0%, #111827 100%)';
        case 'green': return 'linear-gradient(180deg, #22c55e 0%, #15803d 100%)'; // Added for "Check" state
        default: return 'linear-gradient(180deg, #6366f1 0%, #4338ca 100%)';
    }
  };

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.05, translateY: -2 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: getGradient(),
        boxShadow: disabled ? 'none' : '0px 4px 15px rgba(0, 0, 0, 0.3), inset 0px 1px 0px rgba(255, 255, 255, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: 'white',
        fontWeight: 'bold',
        borderRadius: '16px',
        padding: small ? '8px 16px' : '14px 32px',
        width: fullWidth ? '100%' : 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1
      }}
    >
      {Icon && <Icon size={small ? 18 : 22} />}
      <span>{label}</span>
    </motion.button>
  );
};

const PracticeSessionPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { theme, toggleTheme } = useTheme();
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Array<{questionId: number, answer: string, isCorrect: boolean}>>([]);
  const [timeLeft, setTimeLeft] = useState(600); 
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false); 
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New State for "Check Answer" functionality
  const [isChecked, setIsChecked] = useState(false);

  const classId = searchParams.get('class');
  const subject = searchParams.get('subject');
  const chapter = searchParams.get('chapter');

  useEffect(() => {
    const init = async () => {
        if (location.state?.questions) {
            setQuestions(location.state.questions);
        } else if (classId === '10') {
            if (subject === 'maths') {
                // @ts-ignore
                setQuestions(class10MathsData[chapter] || []);
            } else if (subject === 'science') {
                // Returns correct chapter questions from Object
                // @ts-ignore
                setQuestions(class10ScienceData[chapter] || []);
            }
        }
        setLoading(false);
    };
    init();
  }, [classId, subject, chapter, location.state]);

  useEffect(() => {
    if (showResults) return;
    const timer = setInterval(() => setTimeLeft((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [showResults]);

  // Combined Handler for Checking and Moving Next
  const handleCheckOrNext = () => {
    if (!isChecked) {
        // --- STEP 1: CHECK ANSWER ---
        const q = questions[currentQuestionIndex];
        let isCorrect = false;
        if (typeof q.correctAnswer === 'string') isCorrect = selectedOption === q.correctAnswer;
        else if (typeof q.correct_option_index === 'number') isCorrect = q.options.indexOf(selectedOption) === q.correct_option_index;

        // Save answer immediately so we don't lose it
        const newAnswers = [...userAnswers.filter(a => a.questionId !== q.id), { questionId: q.id, answer: selectedOption!, isCorrect }];
        setUserAnswers(newAnswers);
        
        // Show feedback
        setIsChecked(true); 
    } else {
        // --- STEP 2: MOVE TO NEXT QUESTION ---
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(p => p + 1);
            setSelectedOption(null);
            setIsChecked(false); // Reset for next question
        } else {
            setIsSubmitted(true);
            setShowResults(true);
        }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-[#0f172a]' : 'bg-[#F0F2F5]'}`}>Loading...</div>;
  if (!questions.length) return <div className="p-10 text-center">No Questions Found.</div>;

  if (showAnalysis) {
    const correctCount = userAnswers.filter(a => a.isCorrect).length;
    const accuracy = Math.round((correctCount / questions.length) * 100);

    return (
        <div className={`min-h-screen p-4 ${theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-[#F0F2F5] text-slate-900'}`}>
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <button onClick={() => setShowAnalysis(false)} className="flex items-center gap-2 font-bold opacity-70 hover:opacity-100 transition-opacity">
                        <ArrowLeft size={20}/> Back to Summary
                    </button>
                    <h2 className="text-2xl font-bold">Detailed Analysis</h2>
                </div>

                <div className="rounded-[30px] p-8 text-white shadow-xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6"
                     style={{ background: 'linear-gradient(90deg, #2563eb 0%, #4f46e5 100%)' }}>
                    <div>
                        <h2 className="text-3xl font-bold mb-1">{accuracy >= 80 ? "Great Job!" : "Keep Practicing!"}</h2>
                        <p className="opacity-90 text-lg">You scored {correctCount} out of {questions.length}</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 min-w-[100px] border border-white/10 text-center">
                        <div className="text-2xl font-bold">{accuracy}%</div>
                        <div className="text-xs opacity-80 font-bold uppercase">Accuracy</div>
                    </div>
                </div>

                <div className="space-y-6">
                    {questions.map((q, idx) => {
                        const ans = userAnswers.find(a => a.questionId === q.id);
                        const isCorrect = ans?.isCorrect;
                        const correctText = typeof q.correctAnswer === 'string' ? q.correctAnswer : q.options[q.correct_option_index];

                        return (
                            <div key={q.id} className={`p-6 rounded-2xl border-l-8 shadow-sm ${isCorrect ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'} ${theme === 'dark' ? (isCorrect ? 'bg-green-900/20 text-white' : 'bg-red-900/20 text-white') : 'text-slate-900 bg-white'}`}>
                                <div className="flex justify-between mb-3">
                                    <span className="font-bold opacity-60 text-sm uppercase tracking-wide">Question {idx + 1}</span>
                                    {isCorrect ? 
                                        <span className="flex items-center gap-1 text-green-600 font-bold bg-white dark:bg-slate-800 px-3 py-1 rounded-full text-xs shadow-sm"><CheckCircle size={14}/> Correct</span> : 
                                        <span className="flex items-center gap-1 text-red-600 font-bold bg-white dark:bg-slate-800 px-3 py-1 rounded-full text-xs shadow-sm"><XCircle size={14}/> Incorrect</span>
                                    }
                                </div>
                                <h3 className="text-xl font-bold mb-6">{q.question}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-green-900/40 text-green-100 border-green-700' : 'bg-green-100 text-green-900 border-green-200'}`}>
                                        <div className="text-xs font-bold uppercase mb-1 opacity-70">Correct Answer</div>
                                        <div className="font-semibold text-lg">{correctText}</div>
                                    </div>
                                    {!isCorrect && (
                                        <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-red-900/40 text-red-100 border-red-700' : 'bg-red-100 text-red-900 border-red-200'}`}>
                                            <div className="text-xs font-bold uppercase mb-1 opacity-70">Your Answer</div>
                                            <div className="font-semibold text-lg">{ans?.answer || "Skipped"}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-center mt-12 pb-10">
                    <GlossyButton label="Finish Review" variant="dark" onClick={() => navigate('/practice')} />
                </div>
            </div>
        </div>
    );
  }

  if (showResults) {
    const correctCount = userAnswers.filter(a => a.isCorrect).length;
    const accuracy = Math.round((correctCount / questions.length) * 100);
    const coins = correctCount * 5;

    return (
        <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-[#F0F2F5] text-slate-900'}`}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center w-full max-w-2xl">
                <h1 className="text-5xl font-extrabold mb-4">Session Complete! 🎉</h1>
                <p className="text-xl opacity-70 mb-12">Great job practicing today</p>
                <div className="flex flex-wrap justify-center gap-6 mb-12">
                    <div className="w-40 p-6 rounded-3xl bg-blue-500 text-white shadow-xl"><div className="text-5xl font-bold mb-2">{accuracy}%</div><div className="text-sm font-medium opacity-90">Accuracy</div></div>
                    <div className="w-40 p-6 rounded-3xl bg-yellow-500 text-white shadow-xl"><div className="text-5xl font-bold mb-2">{coins}</div><div className="text-sm font-medium opacity-90">Coins</div></div>
                    <div className="w-40 p-6 rounded-3xl bg-green-500 text-white shadow-xl"><div className="text-5xl font-bold mb-2">{formatTime(600 - timeLeft)}</div><div className="text-sm font-medium opacity-90">Time</div></div>
                </div>
                <div className="flex justify-center gap-6">
                    <GlossyButton label="Detailed Analysis" icon={BarChart2} variant="purple" onClick={() => setShowAnalysis(true)} />
                    <GlossyButton label="Continue Practicing" icon={Sparkles} variant="indigo" onClick={() => navigate('/practice')} />
                </div>
            </motion.div>
        </div>
    );
  }

  const q = questions[currentQuestionIndex];
  return (
    <div className={`min-h-screen p-4 font-sans transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-[#F0F2F5] text-slate-900'}`}>
        <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-10">
                <button onClick={() => navigate('/practice')} className={`p-3 rounded-full border transition-all ${theme === 'dark' ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                    <ArrowLeft size={24}/>
                </button>
                <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-3 px-5 py-2.5 rounded-full border shadow-sm ${theme === 'dark' ? 'bg-blue-900/40 border-blue-500/50 text-blue-300' : 'bg-white border-blue-200 text-blue-700'}`}>
                        <Clock size={20} className="text-blue-500" /><span className="font-bold text-lg tabular-nums tracking-wide">{formatTime(timeLeft)}</span>
                    </div>
                    <button onClick={toggleTheme} className={`p-3 rounded-full border transition-all ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-yellow-400' : 'bg-white border-slate-200 text-slate-600'}`}>
                        {theme === 'dark' ? <Sun size={24}/> : <Moon size={24}/>}
                    </button>
                </div>
            </div>
            
            <div className="mb-10">
                <div className="flex justify-between text-sm mb-2 font-medium opacity-70">
                    <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
                    <span>Progress</span>
                </div>
                <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }} className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full" />
                </div>
            </div>

            <div className={`p-10 rounded-[40px] shadow-2xl mb-10 relative overflow-hidden ${theme === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                <div className="inline-block px-4 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-extrabold mb-6 uppercase tracking-widest">1 Mark</div>
                <h2 className="text-3xl font-bold mb-10 leading-snug">{q.question}</h2>
                
                {/* Image Rendering Support */}
                {q.image && (
                   <div className="mb-8 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                      <img src={q.image} alt="Question Diagram" className="w-full h-auto object-contain max-h-[400px] bg-white" />
                   </div>
                )}

                <div className="space-y-4">
                    {q.options.map((opt: string, i: number) => {
                        const isOptCorrect = opt === q.correctAnswer;
                        const isOptSelected = selectedOption === opt;
                        
                        let cardStyle = `p-6 rounded-2xl border-2 transition-all flex items-center gap-6 `;
                        let icon = null;

                        if (isChecked) {
                            // Checked State Styling
                            if (isOptCorrect) {
                                // Correct Answer (Green)
                                cardStyle += `border-green-500 bg-green-50/50 dark:bg-green-900/20 shadow-md ring-1 ring-green-500`;
                                icon = <div className="ml-auto bg-green-600 rounded-full p-1 text-white shadow-lg"><Check size={20} /></div>;
                            } else if (isOptSelected && !isOptCorrect) {
                                // Wrong Selected Answer (Red)
                                cardStyle += `border-red-500 bg-red-50/50 dark:bg-red-900/20 shadow-md ring-1 ring-red-500`;
                                icon = <div className="ml-auto bg-red-600 rounded-full p-1 text-white shadow-lg"><X size={20} /></div>;
                            } else {
                                // Unselected options (Dimmed)
                                cardStyle += `border-transparent opacity-50 bg-slate-50 dark:bg-slate-800/50`;
                            }
                        } else {
                            // Unchecked State Styling (Normal interaction)
                            cardStyle += 'cursor-pointer ';
                            if (selectedOption === opt) {
                                cardStyle += `border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-md ring-1 ring-indigo-500`;
                                icon = <div className="ml-auto bg-indigo-600 rounded-full p-1 text-white shadow-lg"><Check size={20} /></div>;
                            } else {
                                cardStyle += `border-transparent ${theme === 'dark' ? 'bg-slate-700/50 hover:bg-slate-700' : 'bg-slate-50 hover:bg-slate-100 hover:border-slate-200'}`;
                            }
                        }

                        return (
                            <motion.div whileHover={!isChecked ? { scale: 1.01 } : {}} whileTap={!isChecked ? { scale: 0.99 } : {}} key={i}>
                                <div onClick={() => !isChecked && !isSubmitted && setSelectedOption(opt)} className={cardStyle}>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors 
                                        ${isChecked && isOptCorrect ? 'bg-green-600 text-white' : 
                                          isChecked && isOptSelected && !isOptCorrect ? 'bg-red-600 text-white' :
                                          selectedOption === opt ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-300'}`}>
                                        {String.fromCharCode(65 + i)}
                                    </div>
                                    <span className={`font-medium text-xl ${isChecked && isOptCorrect ? 'text-green-700 dark:text-green-300' : isChecked && isOptSelected && !isOptCorrect ? 'text-red-700 dark:text-red-300' : selectedOption === opt ? 'text-indigo-700 dark:text-indigo-300' : ''}`}>
                                        {opt}
                                    </span>
                                    {icon}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            <div className="flex justify-end pb-10">
                <GlossyButton 
                    label={!isChecked ? "Check Answer" : (currentQuestionIndex === questions.length - 1 ? "Finish Quiz" : "Next Question")} 
                    icon={!isChecked ? Target : ChevronRight} 
                    variant={!isChecked ? "indigo" : "green"} 
                    onClick={handleCheckOrNext} 
                    disabled={!selectedOption && !isChecked} 
                />
            </div>
        </div>
    </div>
  );
};

export default PracticeSessionPage;
