import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Check, X, Clock, Award, ChevronRight, Trophy, Sparkles, 
  AlertCircle, Bookmark, Pause, Play, Settings, SkipForward, Target, 
  Sun, Moon, BarChart2, CheckCircle, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase, practiceDB } from '@/lib/supabaseClient';
import { useTheme } from '@/context/ThemeContext';

// Imports from your data folder
import { class10MathsData } from '../data/class10Maths';
import { class10ScienceData } from '../data/class10Science';

// --- GLOSSY BUTTON COMPONENT ---
const GlossyButton = ({ icon: Icon, label, variant = "indigo", onClick, fullWidth = false, small = false, disabled = false, className = "" }: any) => {
    const getGradient = () => {
      switch (variant) {
          case 'indigo': return 'linear-gradient(180deg, #6366f1 0%, #4338ca 100%)';
          case 'purple': return 'linear-gradient(180deg, #a855f7 0%, #7e22ce 100%)'; 
          case 'red': return 'linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)';    
          case 'green': return 'linear-gradient(180deg, #22c55e 0%, #15803d 100%)';
          case 'dark': return 'linear-gradient(180deg, #374151 0%, #111827 100%)';
          default: return 'linear-gradient(180deg, #6366f1 0%, #4338ca 100%)';
      }
    };
  
    return (
      <motion.button
        whileHover={!disabled ? { scale: 1.02, translateY: -1 } : {}}
        whileTap={!disabled ? { scale: 0.98 } : {}}
        onClick={onClick}
        disabled={disabled}
        className={className}
        style={{
          background: getGradient(),
          boxShadow: disabled ? 'none' : '0px 4px 12px rgba(0, 0, 0, 0.2), inset 0px 1px 0px rgba(255, 255, 255, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: 'white',
          fontWeight: 'bold',
          borderRadius: '12px',
          padding: '0 20px',    
          width: fullWidth ? '100%' : 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1
        }}
      >
        {Icon && <Icon size={small ? 16 : 18} />}
        <span>{label}</span>
      </motion.button>
    );
};

const PracticeSessionPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { theme, toggleTheme } = useTheme();

  // --- STATE ---
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Array<{questionId: number, answer: string, isCorrect: boolean, isSkipped?: boolean}>>([]);
  
  // Controls
  const [timeLeft, setTimeLeft] = useState(600); // 10 mins
  const [timerDuration, setTimerDuration] = useState(10); // mins
  const [isPaused, setIsPaused] = useState(false);
  
  // Status
  const [isChecked, setIsChecked] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false); // New state for Analysis
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<number[]>([]);

  // URL Params
  const classId = searchParams.get('class');
  const subject = searchParams.get('subject');
  const chapter = searchParams.get('chapter');

  // --- LOAD DATA ---
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        if (location.state?.questions) {
          setQuestions(location.state.questions);
        } else if (classId === '10' && chapter) {
          let data = [];
          if (subject?.toLowerCase().includes('math')) {
            // @ts-ignore
            data = class10MathsData?.[chapter] || [];
          } else {
            // @ts-ignore
            data = class10ScienceData?.[chapter] || [];
          }
          
          if (data.length > 0) {
            const shuffled = [...data].sort(() => 0.5 - Math.random()).slice(0, 5); 
            setQuestions(shuffled);
          }
        }
      } catch (e) {
        console.error("Error loading questions:", e);
      }
      setLoading(false);
    };
    init();
  }, [classId, subject, chapter]);

  // --- TIMER ---
  useEffect(() => {
    setTimeLeft(timerDuration * 60);
  }, [timerDuration]);

  useEffect(() => {
    if (showResults || isPaused || loading) return;
    const timer = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) { clearInterval(timer); setShowResults(true); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showResults, isPaused, loading]);

  // --- LOGIC HANDLERS ---
  
  useEffect(() => {
    if (questions.length > 0) {
      const q = questions[currentIndex];
      const existingAnswer = userAnswers.find(a => a.questionId === q.id);
      
      if (existingAnswer) {
        setSelectedOption(existingAnswer.answer);
        setIsChecked(!existingAnswer.isSkipped); 
      } else {
        setSelectedOption(null);
        setIsChecked(false);
      }
    }
  }, [currentIndex, questions, userAnswers]);

  const handleOptionSelect = (option: string) => {
    if (!isChecked && !showResults) {
      setSelectedOption(option);
    }
  };

  const handleBookmark = () => {
    const qId = questions[currentIndex].id;
    setBookmarks(prev => prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]);
  };

  const handleCheckOrNext = () => {
    const q = questions[currentIndex];

    if (!isChecked) {
        // CHECK ANSWER
        let isCorrect = false;
        
        if (typeof q.correctAnswer === 'string') isCorrect = selectedOption === q.correctAnswer;
        else if (typeof q.correct_option_index === 'number') isCorrect = q.options.indexOf(selectedOption) === q.correct_option_index;

        const newAnswers = [...userAnswers.filter(a => a.questionId !== q.id), { 
            questionId: q.id, answer: selectedOption!, isCorrect, isSkipped: false 
        }];
        setUserAnswers(newAnswers);
        setIsChecked(true); 
    } else {
        // NEXT QUESTION
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(p => p + 1);
        } else {
            setShowResults(true);
        }
    }
  };

  const handleSkip = () => {
     const q = questions[currentIndex];
     if (!userAnswers.find(a => a.questionId === q.id)) {
        setUserAnswers(prev => [...prev, { questionId: q.id, answer: "", isCorrect: false, isSkipped: true }]);
     }
     
     if (currentIndex < questions.length - 1) {
         setCurrentIndex(p => p + 1);
     } else {
         setShowResults(true);
     }
  };

  const jumpToQuestion = (idx: number) => {
     setCurrentIndex(idx);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- RENDER HELPERS ---
  const getPaletteClass = (idx: number, qId: number) => {
      // 1. Current Question: Solid Purple
      if (idx === currentIndex) return "bg-[#7C4DFF] text-white shadow-lg ring-2 ring-purple-200 transform scale-110 z-10 border-none";

      const ans = userAnswers.find(a => a.questionId === qId);

      // 2. Answered States
      if (ans) {
          if (ans.isSkipped) return "bg-[#FFCA28] text-white border-none"; // Skipped (Yellow)
          if (ans.isCorrect) return "bg-[#00C853] text-white border-none";  // Correct (Green)
          return "bg-[#FF5252] text-white border-none";                     // Wrong (Red)
      }

      // 3. Future/Unvisited: Dark Grey
      return "bg-[#546E7A] text-[#ececec] border-none";
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (questions.length === 0) return <div className="p-10 text-center">No questions found.</div>;

  // --- DETAILED ANALYSIS UI (RESTORED) ---
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

                {/* Analysis Header Card */}
                <div className="rounded-[30px] p-8 text-white shadow-xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6"
                     style={{ background: 'linear-gradient(90deg, #6366f1 0%, #4338ca 100%)' }}>
                    <div>
                        <h2 className="text-3xl font-bold mb-1">{accuracy >= 80 ? "Great Job!" : "Keep Practicing!"}</h2>
                        <p className="opacity-90 text-lg">You scored {correctCount} out of {questions.length}</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 min-w-[100px] border border-white/10 text-center">
                        <div className="text-2xl font-bold">{accuracy}%</div>
                        <div className="text-xs opacity-80 font-bold uppercase">Accuracy</div>
                    </div>
                </div>

                {/* Questions List */}
                <div className="space-y-6">
                    {questions.map((q, idx) => {
                        const ans = userAnswers.find(a => a.questionId === q.id);
                        const isCorrect = ans?.isCorrect;
                        const isSkipped = ans?.isSkipped;
                        const correctText = typeof q.correctAnswer === 'string' ? q.correctAnswer : q.options[q.correct_option_index];

                        return (
                            <div key={q.id} className={`p-6 rounded-2xl border-l-8 shadow-sm 
                                ${isCorrect ? 'bg-green-50 border-green-500' : isSkipped ? 'bg-yellow-50 border-yellow-500' : 'bg-red-50 border-red-500'} 
                                ${theme === 'dark' ? (isCorrect ? 'bg-green-900/20 text-white' : isSkipped ? 'bg-yellow-900/20 text-white' : 'bg-red-900/20 text-white') : 'text-slate-900 bg-white'}`}>
                                
                                <div className="flex justify-between mb-3">
                                    <span className="font-bold opacity-60 text-sm uppercase tracking-wide">Question {idx + 1}</span>
                                    {isCorrect ? 
                                        <span className="flex items-center gap-1 text-green-600 font-bold bg-white dark:bg-slate-800 px-3 py-1 rounded-full text-xs shadow-sm"><CheckCircle size={14}/> Correct</span> : 
                                     isSkipped ?
                                        <span className="flex items-center gap-1 text-yellow-600 font-bold bg-white dark:bg-slate-800 px-3 py-1 rounded-full text-xs shadow-sm"><AlertCircle size={14}/> Skipped</span> :
                                        <span className="flex items-center gap-1 text-red-600 font-bold bg-white dark:bg-slate-800 px-3 py-1 rounded-full text-xs shadow-sm"><XCircle size={14}/> Incorrect</span>
                                    }
                                </div>
                                
                                <h3 className="text-xl font-bold mb-6">{q.question}</h3>
                                
                                {/* Answers Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-green-900/40 text-green-100 border-green-700' : 'bg-green-100 text-green-900 border-green-200'}`}>
                                        <div className="text-xs font-bold uppercase mb-1 opacity-70">Correct Answer</div>
                                        <div className="font-semibold text-lg">{correctText}</div>
                                    </div>
                                    
                                    {!isCorrect && !isSkipped && (
                                        <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-red-900/40 text-red-100 border-red-700' : 'bg-red-100 text-red-900 border-red-200'}`}>
                                            <div className="text-xs font-bold uppercase mb-1 opacity-70">Your Answer</div>
                                            <div className="font-semibold text-lg">{ans?.answer || "None"}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-center mt-12 pb-10">
                    <GlossyButton label="Finish Review" variant="dark" onClick={() => navigate('/daily-practice')} />
                </div>
            </div>
        </div>
    );
  }

  // --- RESULTS UI ---
  if (showResults) {
    const correctAnswers = userAnswers.filter(a => a.isCorrect).length;
    const coinsEarned = correctAnswers * 5;
    return (
      <div className={`min-h-screen bg-gradient-to-b from-indigo-50 to-white p-4 flex items-center justify-center ${theme === 'dark' ? 'bg-[#0f172a]' : ''}`}>
        <Card className="w-full max-w-lg shadow-xl border-slate-200">
            <CardContent className="p-8 text-center">
                 <div className="mx-auto w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
                    <Trophy className="text-yellow-600" size={40} />
                 </div>
                 <h1 className="text-3xl font-bold text-slate-900 mb-2">Practice Complete!</h1>
                 <p className="text-slate-600 mb-8">You answered {correctAnswers} out of {questions.length} correctly.</p>
                 <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-2xl font-bold text-indigo-600">{Math.round((correctAnswers/questions.length)*100)}%</div>
                        <div className="text-xs text-slate-500 uppercase font-bold">Accuracy</div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-2xl font-bold text-yellow-600">+{coinsEarned}</div>
                        <div className="text-xs text-slate-500 uppercase font-bold">Coins</div>
                    </div>
                 </div>
                 <div className="flex gap-3 flex-col sm:flex-row">
                    <GlossyButton variant="purple" label="Detailed Analysis" icon={BarChart2} onClick={() => setShowAnalysis(true)} fullWidth className="h-11" />
                    <GlossyButton variant="indigo" label="Try Again" onClick={() => window.location.reload()} fullWidth className="h-11" />
                 </div>
                 <div className="mt-4">
                     <Button variant="ghost" onClick={() => navigate('/daily-practice')} className="text-slate-500">Back to Dashboard</Button>
                 </div>
            </CardContent>
        </Card>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const isBookmarked = bookmarks.includes(currentQ.id);

  return (
    <div className={`min-h-screen p-4 font-sans transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-[#F0F2F5] text-slate-900'}`}>
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
           <button onClick={() => navigate('/daily-practice')} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors">
             <ArrowLeft size={20}/> <span className="font-medium">Quit</span>
           </button>

           <div className="flex items-center gap-3">
              {/* Timer Pod */}
              <div className={`border shadow-sm rounded-full px-1 py-1 flex items-center ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <button onClick={() => setIsPaused(!isPaused)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                      {isPaused ? <Play size={16} className="text-green-600 fill-green-600"/> : <Pause size={16} className="text-slate-400"/>}
                  </button>
                  <span className={`font-mono font-bold w-14 text-center ${timeLeft < 60 ? 'text-red-500' : theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                      {formatTime(timeLeft)}
                  </span>
                  
                  {/* Timer Settings */}
                  <Popover>
                    <PopoverTrigger asChild>
                       <button className="p-2 hover:bg-slate-100 rounded-full"><Settings size={16} className="text-slate-400"/></button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-3">
                        <div className="text-sm font-medium mb-2">Adjust Time (Min)</div>
                        <div className="flex items-center justify-between">
                            <Button size="sm" variant="outline" onClick={() => setTimerDuration(d => Math.max(1, d-5))}>-5</Button>
                            <span className="font-bold">{timerDuration}</span>
                            <Button size="sm" variant="outline" onClick={() => setTimerDuration(d => d+5)}>+5</Button>
                        </div>
                    </PopoverContent>
                  </Popover>
              </div>

              {/* Dark Mode Toggle */}
              <button 
                onClick={toggleTheme} 
                className={`p-2.5 rounded-full border transition-all ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-yellow-400' : 'bg-white border-slate-200 text-slate-600'}`}
              >
                 {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
           </div>
        </div>

        {/* Question Palette (Numbers) */}
        <div className="mb-6 overflow-x-auto pb-2 no-scrollbar">
            <div className="flex gap-2 min-w-max px-1">
                {questions.map((q, idx) => (
                    <div key={q.id} className="relative">
                        <button 
                           onClick={() => jumpToQuestion(idx)}
                           className={`w-11 h-11 rounded-xl font-bold text-lg flex items-center justify-center transition-all shadow-sm ${getPaletteClass(idx, q.id)}`}
                        >
                            {idx + 1}
                        </button>
                        {/* Bookmark Badge */}
                        {bookmarks.includes(q.id) && (
                            <div className="absolute -top-1 -right-1 bg-yellow-400 text-white rounded-full p-[2px] shadow-sm z-20">
                                <Bookmark size={8} fill="currentColor" />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
            <div className="flex justify-between text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                <span>Progress</span>
                <span>{Math.round(((currentIndex) / questions.length) * 100)}%</span>
            </div>
            <Progress value={((currentIndex) / questions.length) * 100} className={`h-2 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`} />
        </div>

        {/* Main Card */}
        <div className="relative">
           {isPaused && (
               <div className="absolute inset-0 z-20 backdrop-blur-sm bg-white/50 dark:bg-black/50 flex items-center justify-center rounded-3xl">
                   <div className={`px-8 py-4 rounded-full shadow-xl font-bold text-lg flex items-center gap-3 ${theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'}`}>
                       <Pause size={20}/> Paused
                   </div>
               </div>
           )}

           <Card className={`border-0 shadow-xl rounded-[32px] overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
              <div className="h-2 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
              
              <CardContent className="p-8">
                  <div className="flex justify-between items-start mb-6">
                      <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                          Question {currentIndex + 1}
                      </span>
                      <button onClick={handleBookmark} className={`transition-colors p-2 rounded-full hover:bg-slate-50 ${bookmarks.includes(currentQ.id) ? "text-yellow-500" : "text-slate-300"}`}>
                          <Bookmark size={24} className={bookmarks.includes(currentQ.id) ? "fill-current" : ""} />
                      </button>
                  </div>

                  <h2 className={`text-xl md:text-2xl font-bold leading-relaxed mb-8 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                      {currentQ.question}
                  </h2>

                  {currentQ.image && (
                      <div className="mb-8 rounded-xl overflow-hidden border border-slate-100 bg-slate-50 p-2 flex justify-center">
                          <img src={currentQ.image} alt="Diagram" className="w-full h-auto object-contain max-h-64 mix-blend-multiply" />
                      </div>
                  )}

                  <div className="space-y-3">
                      {currentQ.options.map((opt: string, idx: number) => {
                          const isOptSelected = selectedOption === opt;
                          const isCorrectAnswer = opt === currentQ.correctAnswer || (currentQ.options && opt === currentQ.options[currentQ.correct_option_index]);
                          
                          let styleClass = theme === 'dark' ? "border-slate-700 hover:border-slate-600 bg-slate-700/30" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"; 
                          let icon = <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${theme === 'dark' ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{String.fromCharCode(65 + idx)}</div>;
                          
                          if (isChecked) {
                              if (isCorrectAnswer) {
                                  styleClass = "border-green-500 bg-green-50/50 dark:bg-green-900/20 ring-1 ring-green-500";
                                  icon = <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center"><Check size={16}/></div>;
                              } else if (isOptSelected && !isCorrectAnswer) {
                                  styleClass = "border-red-500 bg-red-50/50 dark:bg-red-900/20 ring-1 ring-red-500";
                                  icon = <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center"><X size={16}/></div>;
                              } else {
                                  styleClass = "border-slate-100 opacity-50 dark:border-slate-700";
                              }
                          } else if (isOptSelected) {
                              styleClass = "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-600";
                              icon = <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">{String.fromCharCode(65 + idx)}</div>;
                          }

                          return (
                              <div 
                                key={idx}
                                onClick={() => !isChecked && handleOptionSelect(opt)}
                                className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${styleClass}`}
                              >
                                  {icon}
                                  <span className={`font-medium text-base flex-1 ${isChecked && isCorrectAnswer ? 'text-green-700 dark:text-green-400' : isChecked && isOptSelected ? 'text-red-700 dark:text-red-400' : theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                                      {opt}
                                  </span>
                              </div>
                          )
                      })}
                  </div>
              </CardContent>
           </Card>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-4 mt-8">
            <GlossyButton 
                label="Skip" 
                icon={SkipForward} 
                variant="red" 
                onClick={handleSkip} 
                disabled={isChecked}
                className="h-11 flex-1 text-sm"
            />
            
            <GlossyButton 
                label={!isChecked ? "Check Answer" : (currentIndex === questions.length - 1 ? "Finish Quiz" : "Next Question")} 
                icon={!isChecked ? Target : ChevronRight} 
                variant={!isChecked ? "purple" : "green"} 
                onClick={handleCheckOrNext} 
                disabled={!selectedOption && !isChecked}
                className="h-11 flex-[2] text-sm"
                fullWidth
            />
        </div>

      </div>
    </div>
  );
};

export default PracticeSessionPage;
