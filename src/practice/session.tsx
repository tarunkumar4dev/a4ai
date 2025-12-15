// src/pages/practice/session.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { 
  Clock, 
  Award, 
  CheckCircle, 
  XCircle, 
  ChevronLeft, 
  ChevronRight,
  Home,
  Zap,
  BookOpen,
  AlertCircle,
  Trophy,
  Sparkles,
  Flame
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase, practiceDB } from '@/lib/supabaseClient';

const PracticeSession = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const className = searchParams.get('class');
  const subject = searchParams.get('subject');
  
  console.log('🔍 [1] URL Parameters:', { 
    className, 
    subject,
    fullURL: window.location.href,
    allParams: Object.fromEntries(searchParams.entries())
  });

  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [userCoins, setUserCoins] = useState(0);
  const [timeLeft, setTimeLeft] = useState(300);
  const [userId, setUserId] = useState<string | null>(null);
  const [userStreak, setUserStreak] = useState(0);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    console.log('👤 [2] Getting user...');
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('👤 [3] User object:', user);
      console.log('👤 [4] User ID:', user?.id);
      setUserId(user?.id || null);
      
      if (user?.id) {
        try {
          console.log('👤 [5] Fetching user profile for ID:', user.id);
          const profile = await practiceDB.getUserPracticeProfile(user.id);
          console.log('👤 [6] User Profile data:', profile);
          setUserCoins(profile?.total_coins || 0);
          setUserStreak(profile?.practice_streak || 0);
        } catch (error) {
          console.error('❌ [7] Error fetching user profile:', error);
        }
      } else {
        console.log('⚠️ [8] No user logged in');
      }
    };
    getUser();
  }, []);

  // Fetch questions - FIXED TABLE NAME (back to practice_questions)
  useEffect(() => {
    console.log('🔄 [9] useEffect triggered with params:', { className, subject });
    
    if (!className || !subject) {
      console.error('❌ [10] Missing className or subject');
      setError('Missing class or subject parameters');
      setLoading(false);
      navigate('/daily-practice');
      return;
    }

    console.log('✅ [11] Params valid, fetching questions...');
    fetchQuestions();
  }, [className, subject, navigate]);

  const fetchQuestions = async () => {
    try {
      console.log('📥 [12] Starting fetchQuestions...');
      console.log('📊 [13] Query params:', { 
        table: 'practice_questions', // ✅ CORRECT: underscore वाला table name
        className,
        subject,
        is_active: true 
      });

      // Get questions already attempted today
      console.log('📥 [14] Getting attempted questions for userId:', userId);
      const attemptedIds = userId ? await practiceDB.getQuestionsAttemptedToday(userId) : [];
      console.log('📥 [15] Attempted question IDs:', attemptedIds);

      // First try with is_active filter
      let allQuestions: any[] = [];
      let supabaseError = null;
      
      console.log('📡 [16] Fetching from practice_questions with filters...');
      // ✅ CORRECTED: Back to original table name
      const { data: activeData, error: activeError } = await supabase
        .from('practice_questions')  // ✅ CORRECT TABLE NAME (underscore)
        .select('*')
        .eq('class', className)
        .eq('subject', subject)
        .eq('is_active', true)
        .limit(10);

      console.log('📦 [17] Supabase Response (with is_active):', {
        data: activeData,
        error: activeError,
        count: activeData?.length || 0
      });

      if (activeError) {
        console.error('❌ [18] Supabase error:', activeError);
        supabaseError = activeError;
      }

      if (!activeData || activeData.length === 0) {
        console.warn('⚠️ [19] No questions found with is_active filter. Trying without filter...');
        
        // Try without is_active filter
        const { data: allData, error: allError } = await supabase
          .from('practice_questions')  // ✅ CORRECT TABLE NAME
          .select('*')
          .eq('class', className)
          .eq('subject', subject)
          .limit(10);

        console.log('🔄 [20] Fallback query result:', {
          data: allData,
          error: allError,
          count: allData?.length || 0
        });

        if (allError) {
          console.error('❌ [21] Fallback query error:', allError);
          supabaseError = allError;
        }

        allQuestions = allData || [];
        
        if (allQuestions.length === 0) {
          // Check what's actually in the database
          const { data: sampleData } = await supabase
            .from('practice_questions')  // ✅ CORRECT TABLE NAME
            .select('class, subject, question_text')
            .limit(10);

          console.log('📋 [22] Sample of database content:', sampleData);
          
          const errorMsg = `No questions found for ${className} - ${subject}. `;
          console.error('❌ [23] ' + errorMsg);
          setError(errorMsg + `Database has: ${JSON.stringify(sampleData?.slice(0, 3))}`);
        } else {
          console.log('✅ [24] Found', allQuestions.length, 'questions without is_active filter');
        }
      } else {
        allQuestions = activeData;
        console.log('✅ [25] Found', activeData.length, 'questions with is_active filter');
      }

      console.log('📥 [26] All questions from DB:', allQuestions);
      console.log('📥 [27] Number of questions:', allQuestions?.length || 0);

      if (allQuestions.length === 0) {
        console.error('❌ [28] No questions found in database for:', { className, subject });
        setError(`No questions available for ${className} - ${subject}`);
        setQuestions([]);
        return;
      }

      // Filter out already attempted questions
      const newQuestions = allQuestions.filter((q: any) => !attemptedIds.includes(q.id)).slice(0, 5);
      console.log('📥 [29] New questions (not attempted):', newQuestions);
      console.log('📥 [30] New questions count:', newQuestions.length);

      // If not enough new questions, use some attempted ones
      let finalQuestions: any[] = [];
      if (newQuestions.length < 5) {
        console.log('⚠️ [31] Not enough new questions. Need:', 5 - newQuestions.length);
        const needed = 5 - newQuestions.length;
        const attemptedQuestions = allQuestions
          .filter((q: any) => attemptedIds.includes(q.id))
          .slice(0, needed);
        console.log('📥 [32] Adding attempted questions:', attemptedQuestions);
        finalQuestions = [...newQuestions, ...attemptedQuestions];
      } else {
        finalQuestions = newQuestions;
      }

      console.log('📥 [33] Final questions set:', finalQuestions);
      console.log('📥 [34] Questions count:', finalQuestions.length);
      
      // Check question structure
      if (finalQuestions.length > 0) {
        console.log('🔍 [35] First question structure:', {
          id: finalQuestions[0].id,
          question_text: finalQuestions[0].question_text,
          options: finalQuestions[0].options,
          correct_option_index: finalQuestions[0].correct_option_index,
          difficulty: finalQuestions[0].difficulty,
          class: finalQuestions[0].class,
          subject: finalQuestions[0].subject
        });
      }

      setQuestions(finalQuestions);
      
    } catch (error: any) {
      console.error('🔥 [36] Error in fetchQuestions:', error);
      setError(error.message || 'Failed to fetch questions');
    } finally {
      console.log('🏁 [37] fetchQuestions completed, setting loading false');
      setLoading(false);
    }
  };

  // Timer
  useEffect(() => {
    if (timeLeft <= 0 || questions.length === 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft, questions]);

  const handleAnswer = useCallback(async (questionId: string, selectedIndex: number) => {
    console.log('💾 [38] handleAnswer called:', { questionId, selectedIndex });
    if (!userId) {
      console.error('❌ [39] No userId found!');
      return;
    }
    
    if (answers[questionId]) {
      console.log('⚠️ [40] Question already answered:', questionId);
      return;
    }
    
    const question = questions.find(q => q.id === questionId);
    if (!question) {
      console.error('❌ [41] Question not found:', questionId);
      return;
    }
    
    const isCorrect = selectedIndex === question.correct_option_index;
    console.log('💾 [42] Answer details:', { 
      questionId, 
      selectedIndex, 
      correctIndex: question.correct_option_index,
      isCorrect 
    });
    
    // Save to database
    console.log('💾 [43] Saving to database...');
    const result = await practiceDB.savePracticeAttempt(
      userId, 
      questionId, 
      selectedIndex, 
      isCorrect
    );
    
    console.log('💾 [44] Database save result:', result);
    
    if (result.success) {
      // Update local state
      setAnswers(prev => ({
        ...prev,
        [questionId]: {
          selectedIndex,
          isCorrect,
          earnedCoins: result.coinsEarned
        }
      }));
      
      // Update coins if correct
      if (result.coinsEarned > 0) {
        setUserCoins(prev => prev + result.coinsEarned);
        console.log('💰 [45] Coins updated:', userCoins + result.coinsEarned);
      }
    } else {
      console.error('❌ [46] Database save failed:', result);
    }
  }, [userId, answers, questions, userCoins]);

  const handleTimeUp = () => {
    console.log('⏰ [47] Time up!');
    // Auto-submit current question if not answered
    const currentQ = questions[currentIndex];
    if (currentQ && !answers[currentQ.id]) {
      console.log('⏰ [48] Auto-submitting unanswered question:', currentQ.id);
      handleAnswer(currentQ.id, -1);
    }
  };

  const handleFinishPractice = () => {
    console.log('🏁 [49] Finishing practice...');
    const answeredCount = Object.keys(answers).length;
    const correctCount = Object.values(answers).filter((a: any) => a.isCorrect).length;
    const earnedCoins = Object.values(answers).reduce((sum: number, a: any) => sum + (a.earnedCoins || 0), 0);
    
    console.log('📊 [50] Final stats:', { answeredCount, correctCount, earnedCoins });
    
    // Show summary modal
    setShowFinishModal(true);
  };

  const handleBackToPractice = () => {
    console.log('🔙 [51] Going back to practice selection');
    navigate('/daily-practice');
  };

  if (error) {
    console.log('❌ [52] Error state:', error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4">
        <Card className="max-w-md w-full border-0 shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="text-red-600" size={40} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Error Loading Questions</h2>
            <p className="text-gray-700 mb-2">{error}</p>
            <p className="text-sm text-gray-500 mb-4">
              Parameters received: Class = "{className}", Subject = "{subject}"
            </p>
            <div className="space-y-3">
              <Button 
                onClick={() => navigate('/daily-practice')}
                className="w-full bg-blue-600 hover:bg-blue-700 h-12"
              >
                <ChevronLeft size={20} className="mr-2" />
                Go Back to Practice
              </Button>
              <Button 
                onClick={() => navigate('/')}
                variant="outline"
                className="w-full h-12"
              >
                <Home size={20} className="mr-2" />
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    console.log('⏳ [53] Loading state: true');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading practice questions...</p>
          <p className="text-gray-400 text-sm mt-2">Preparing your daily challenge</p>
          <div className="mt-4 text-xs text-gray-500">
            Debug: class={className}, subject={subject}
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    console.log('❌ [54] No questions available');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4">
        <Card className="max-w-md w-full border-0 shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="text-yellow-600" size={40} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">No Questions Available</h2>
            <p className="text-gray-600 mb-6">
              Questions for <span className="font-bold">{className} - {subject}</span> are not available right now.
              Please try another subject or check back later.
            </p>
            <div className="space-y-3">
              <Button 
                onClick={() => navigate('/daily-practice')}
                className="w-full bg-blue-600 hover:bg-blue-700 h-12"
              >
                <ChevronLeft size={20} className="mr-2" />
                Choose Another Class
              </Button>
              <Button 
                onClick={() => navigate('/')}
                variant="outline"
                className="w-full h-12"
              >
                <Home size={20} className="mr-2" />
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const userAnswer = answers[currentQuestion?.id];
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = questions.length;
  const isCompleted = answeredCount === totalQuestions;
  const progressPercentage = (answeredCount / totalQuestions) * 100;
  
  // Calculate stats
  const correctCount = Object.values(answers).filter((a: any) => a.isCorrect).length;
  const earnedCoins = Object.values(answers).reduce((sum: number, a: any) => sum + (a.earnedCoins || 0), 0);

  console.log('📊 [55] Current state:', { 
    currentIndex, 
    currentQuestionId: currentQuestion?.id,
    answeredCount, 
    totalQuestions,
    progressPercentage,
    questionsCount: questions.length
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToPractice}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all"
              >
                <ChevronLeft size={20} strokeWidth={2.5} />
              </button>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  Daily Practice
                </h1>
                <p className="text-sm text-slate-500">
                  {className} • {subject}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Streak */}
              {userStreak > 0 && (
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-full border border-orange-100">
                  <Flame size={14} className="text-orange-500 fill-orange-500" />
                  <span className="font-bold text-orange-700 text-sm">
                    {userStreak} day streak
                  </span>
                </div>
              )}

              {/* Timer */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-full border border-red-100">
                <Clock size={14} className="text-red-500" />
                <span className="font-bold text-red-700 text-sm">
                  {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                </span>
              </div>

              {/* Coins */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 rounded-full border border-yellow-100">
                <Award size={14} className="text-yellow-600" />
                <span className="font-bold text-yellow-700 text-sm">
                  {userCoins}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Progress Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm text-slate-500 font-medium">Progress</h3>
                  <p className="text-2xl font-bold text-slate-900">
                    {answeredCount}/{totalQuestions}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <BookOpen className="text-blue-600" size={24} />
                </div>
              </div>
              <Progress value={progressPercentage} className="mt-4" />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm text-slate-500 font-medium">Correct Answers</h3>
                  <p className="text-2xl font-bold text-green-600">
                    {correctCount}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle className="text-green-600" size={24} />
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-4">
                Accuracy: {answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0}%
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm text-slate-500 font-medium">Coins Earned</h3>
                  <p className="text-2xl font-bold text-yellow-600">
                    +{earnedCoins}
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <Sparkles className="text-yellow-600" size={24} />
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-4">
                5 coins per correct answer
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Question Card */}
        <Card className="rounded-2xl border-slate-200 shadow-lg mb-8 overflow-hidden">
          <CardContent className="p-0">
            {/* Question Header */}
            <div className="border-b border-slate-100 p-6 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge 
                    variant="outline"
                    className={clsx(
                      "border-2 font-bold",
                      currentQuestion.difficulty === 'Easy' 
                        ? 'border-green-200 text-green-700 bg-green-50'
                        : currentQuestion.difficulty === 'Medium'
                        ? 'border-yellow-200 text-yellow-700 bg-yellow-50'
                        : 'border-red-200 text-red-700 bg-red-50'
                    )}
                  >
                    {currentQuestion.difficulty}
                  </Badge>
                  <span className="text-slate-500 text-sm">
                    Question {currentIndex + 1} of {totalQuestions}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-700 font-bold text-sm">M</span>
                  </div>
                  <span className="text-slate-700 font-bold">{currentQuestion.marks || 1}</span>
                </div>
              </div>
            </div>

            {/* Question Text */}
            <div className="p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-8 leading-relaxed">
                {currentQuestion.question_text}
              </h2>

              {/* Options */}
              <div className="space-y-3">
                {currentQuestion.options?.map((option: string, index: number) => {
                  const isSelected = userAnswer?.selectedIndex === index;
                  const isCorrect = index === currentQuestion.correct_option_index;
                  const isAnswered = !!userAnswer;
                  
                  return (
                    <motion.div
                      key={index}
                      whileHover={!isAnswered ? { scale: 1.01 } : {}}
                      whileTap={!isAnswered ? { scale: 0.99 } : {}}
                    >
                      <button
                        disabled={isAnswered}
                        onClick={() => handleAnswer(currentQuestion.id, index)}
                        className={clsx(
                          "w-full p-4 text-left rounded-xl border-2 transition-all duration-200",
                          !isAnswered
                            ? "border-slate-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer"
                            : isCorrect
                            ? "border-green-500 bg-green-50"
                            : isSelected && !isCorrect
                            ? "border-red-500 bg-red-50"
                            : "border-slate-200 bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {/* Option Letter */}
                          <div className={clsx(
                            "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg shrink-0",
                            !isAnswered
                              ? "bg-slate-100 text-slate-700"
                              : isCorrect
                              ? "bg-green-500 text-white"
                              : isSelected && !isCorrect
                              ? "bg-red-500 text-white"
                              : "bg-slate-200 text-slate-600"
                          )}>
                            {String.fromCharCode(65 + index)}
                          </div>
                          
                          {/* Option Text */}
                          <span className="flex-1 text-left">{option}</span>
                          
                          {/* Icons */}
                          {isAnswered && isCorrect && (
                            <CheckCircle className="text-green-500 shrink-0" size={22} />
                          )}
                          {isAnswered && isSelected && !isCorrect && (
                            <XCircle className="text-red-500 shrink-0" size={22} />
                          )}
                        </div>
                        
                        {/* Wrong answer message */}
                        {isAnswered && isSelected && !isCorrect && (
                          <div className="mt-3 ml-12 text-sm text-slate-600">
                            <span className="font-medium">Correct answer:</span>{" "}
                            <span className="text-green-700 font-medium">
                              {currentQuestion.options[currentQuestion.correct_option_index]}
                            </span>
                          </div>
                        )}
                      </button>
                    </motion.div>
                  );
                })}
              </div>

              {/* Explanation */}
              {userAnswer && currentQuestion.explanation && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 p-5 bg-blue-50 rounded-xl border border-blue-200"
                >
                  <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center">
                      <Zap size={12} />
                    </div>
                    Explanation
                  </h4>
                  <p className="text-blue-800 leading-relaxed">{currentQuestion.explanation}</p>
                  
                  {userAnswer.isCorrect && (
                    <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      <Award size={16} />
                      +{userAnswer.earnedCoins} coins earned!
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Navigation & Question Palette */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Navigation Buttons */}
          <div className="lg:col-span-8">
            <div className="flex justify-between">
              <Button
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                variant="outline"
                className="h-12 px-6 rounded-xl"
              >
                <ChevronLeft size={20} className="mr-2" />
                Previous
              </Button>
              
              <Button
                onClick={() => {
                  if (currentIndex < totalQuestions - 1) {
                    setCurrentIndex(prev => prev + 1);
                  } else {
                    handleFinishPractice();
                  }
                }}
                disabled={!userAnswer && currentIndex === totalQuestions - 1}
                className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700"
              >
                {currentIndex < totalQuestions - 1 ? (
                  <>
                    Next Question
                    <ChevronRight size={20} className="ml-2" />
                  </>
                ) : (
                  'Finish Practice'
                )}
              </Button>
            </div>
          </div>

          {/* Question Palette */}
          <div className="lg:col-span-4">
            <Card className="rounded-2xl border-slate-200">
              <CardContent className="p-6">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Trophy size={18} className="text-indigo-500" />
                  Question Palette
                </h3>
                <div className="flex flex-wrap gap-2">
                  {questions.map((q, index) => (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(index)}
                      className={clsx(
                        "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg transition-all",
                        currentIndex === index
                          ? "bg-blue-600 text-white shadow-lg scale-105"
                          : answers[q.id]
                          ? answers[q.id].isCorrect
                            ? "bg-green-100 text-green-700 border-2 border-green-300"
                            : "bg-red-100 text-red-700 border-2 border-red-300"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      )}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Finish Modal */}
      {showFinishModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8"
          >
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Award className="text-white" size={40} />
              </div>
              
              <h1 className="text-3xl font-bold text-slate-900 mb-3">
                Practice Complete! 🎉
              </h1>
              
              <p className="text-slate-600 mb-6">
                You've completed today's practice session.
              </p>
              
              <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-xl mb-8">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900">{answeredCount}/5</div>
                    <div className="text-sm text-slate-500">Answered</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{correctCount}</div>
                    <div className="text-sm text-slate-500">Correct</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">+{earnedCoins}</div>
                    <div className="text-sm text-slate-500">Coins</div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <Button
                  onClick={() => navigate('/daily-practice')}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 rounded-xl"
                >
                  Practice Another Set
                </Button>
                
                <Button
                  onClick={() => navigate('/')}
                  variant="outline"
                  className="w-full h-12 rounded-xl"
                >
                  Back to Home
                </Button>
              </div>
              
              <p className="text-sm text-slate-500 mt-6">
                Come back tomorrow for new questions!
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PracticeSession;