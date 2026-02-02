// src/pages/practice/session/index.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Check, 
  X, 
  Clock, 
  Award,
  ChevronRight,
  ChevronLeft,
  Trophy,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase, practiceDB } from '@/lib/supabaseClient';

const PracticeSessionPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Array<{questionId: number, answer: string, isCorrect: boolean}>>([]);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const classId = searchParams.get('class');
  const subject = searchParams.get('subject');
  const chapter = searchParams.get('chapter');
  
  // Get questions from location state or fetch from database
  const questions = location.state?.questions || [];

  useEffect(() => {
    const initializeSession = async () => {
      setLoading(true);
      
      // If no questions in state, fetch from database
      if (questions.length === 0) {
        // Here you would fetch questions from your database
        // For now, we'll use the Chapter 1 questions as fallback
        setLoading(false);
      } else {
        setLoading(false);
      }
    };

    initializeSession();
  }, []);

  useEffect(() => {
    // Timer logic
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOptionSelect = (option: string) => {
    if (!isSubmitted) {
      setSelectedOption(option);
    }
  };

  const handleNext = () => {
    if (selectedOption) {
      const currentQuestion = questions[currentQuestionIndex];
      const isCorrect = selectedOption === currentQuestion.correctAnswer;
      
      // Save answer
      setUserAnswers(prev => [...prev, {
        questionId: currentQuestion.id,
        answer: selectedOption,
        isCorrect
      }]);

      // Move to next question or show results
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedOption(null);
      } else {
        handleSubmit();
      }
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      // Find previous answer if exists
      const prevAnswer = userAnswers.find(a => a.questionId === questions[currentQuestionIndex - 1]?.id);
      setSelectedOption(prevAnswer?.answer || null);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitted(true);
    
    // Calculate score
    const score = userAnswers.filter(answer => answer.isCorrect).length;
    
    // Save results to database
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await practiceDB.savePracticeResults({
          userId: user.id,
          classId: classId || '10',
          subject: subject || 'science',
          chapter: chapter || 'chapter-1',
          score: score,
          totalQuestions: questions.length,
          answers: userAnswers,
          timeSpent: 600 - timeLeft
        });
      }
    } catch (error) {
      console.error('Error saving results:', error);
    }

    setShowResults(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading questions...</p>
        </div>
      </div>
    );
  }

  if (showResults) {
    const correctAnswers = userAnswers.filter(a => a.isCorrect).length;
    const totalQuestions = questions.length;
    const score = Math.round((correctAnswers / totalQuestions) * 100);
    const coinsEarned = correctAnswers * 5;

    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => navigate('/practice')}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft size={20} />
              Back to Practice
            </button>
            <div className="text-sm text-slate-500">
              Class {classId} • {subject} • {chapter}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl font-bold text-slate-900 mb-4">
              Practice Session Completed! 🎉
            </h1>
            <p className="text-slate-600">
              You've completed {chapter} of {subject}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="rounded-2xl border-blue-200">
              <CardContent className="p-6 text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">{score}%</div>
                <div className="text-sm text-slate-600">Score</div>
                <div className="text-lg font-bold text-slate-900 mt-2">
                  {correctAnswers}/{totalQuestions} Correct
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-yellow-200">
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Award className="text-yellow-600" size={24} />
                  <div className="text-3xl font-bold text-yellow-600">{coinsEarned}</div>
                </div>
                <div className="text-sm text-slate-600">Coins Earned</div>
                <div className="text-lg font-bold text-slate-900 mt-2">
                  +{coinsEarned} coins
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-green-200">
              <CardContent className="p-6 text-center">
                <div className="text-4xl font-bold text-green-600 mb-2">
                  {formatTime(600 - timeLeft)}
                </div>
                <div className="text-sm text-slate-600">Time Taken</div>
                <div className="text-lg font-bold text-slate-900 mt-2">
                  {600 - timeLeft} seconds
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl border-slate-200 mb-8">
            <CardContent className="p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Question Review</h2>
              <div className="space-y-6">
                {questions.map((question: any, index: number) => {
                  const userAnswer = userAnswers.find(a => a.questionId === question.id);
                  return (
                    <div key={question.id} className="border-b border-slate-100 pb-6 last:border-0">
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          userAnswer?.isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                        }`}>
                          {userAnswer?.isCorrect ? <Check size={14} /> : <X size={14} />}
                        </div>
                        <div>
                          <div className="text-sm text-slate-500 mb-1">Question {index + 1}</div>
                          <h3 className="font-medium text-slate-900">{question.question}</h3>
                        </div>
                      </div>
                      
                      <div className="ml-9 space-y-2">
                        {question.options.map((option: string, optIndex: number) => {
                          const isCorrect = option === question.correctAnswer;
                          const isSelected = userAnswer?.answer === option;
                          return (
                            <div
                              key={optIndex}
                              className={`p-3 rounded-lg border ${
                                isCorrect
                                  ? 'bg-green-50 border-green-200'
                                  : isSelected && !isCorrect
                                  ? 'bg-red-50 border-red-200'
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                  isCorrect
                                    ? 'bg-green-100 text-green-600'
                                    : isSelected && !isCorrect
                                    ? 'bg-red-100 text-red-600'
                                    : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {String.fromCharCode(65 + optIndex)}
                                </div>
                                <span className={
                                  isCorrect
                                    ? 'text-green-700 font-medium'
                                    : isSelected && !isCorrect
                                    ? 'text-red-700'
                                    : 'text-slate-700'
                                }>
                                  {option}
                                </span>
                                {isCorrect && (
                                  <span className="ml-auto text-xs font-medium text-green-600">
                                    Correct Answer
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate('/practice')}
            >
              Back to Practice
            </Button>
            <Button
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              onClick={() => navigate(`/practice/session?class=${classId}&subject=${subject}&chapter=${chapter}`, {
                state: { questions }
              })}
            >
              <Sparkles size={16} className="mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/practice')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={20} />
            Back
          </button>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-full">
              <Clock size={16} className="text-blue-600" />
              <span className="font-bold text-blue-700">{formatTime(timeLeft)}</span>
            </div>
            
            <div className="hidden sm:block text-sm text-slate-500">
              Class {classId} • {subject} • {chapter}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-600">
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <span className="text-sm font-medium text-slate-900">
              {Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}%
            </span>
          </div>
          <Progress 
            value={((currentQuestionIndex + 1) / questions.length) * 100} 
            className="h-2"
          />
        </div>

        {/* Question Card */}
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          <Card className="rounded-2xl border-slate-200 shadow-lg mb-8">
            <CardContent className="p-8">
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
                  <Trophy size={14} />
                  Question {currentQuestionIndex + 1} • {currentQuestion.marks} mark
                </div>
                <h2 className="text-xl font-bold text-slate-900 leading-relaxed">
                  {currentQuestion.question}
                </h2>
              </div>

              <div className="space-y-4">
                {currentQuestion.options.map((option: string, index: number) => (
                  <motion.div
                    key={index}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedOption === option
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                      onClick={() => handleOptionSelect(option)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          selectedOption === option
                            ? 'bg-indigo-100 text-indigo-600'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {String.fromCharCode(65 + index)}
                        </div>
                        <span className={`font-medium ${
                          selectedOption === option ? 'text-indigo-700' : 'text-slate-700'
                        }`}>
                          {option}
                        </span>
                        {selectedOption === option && (
                          <div className="ml-auto w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                            <Check size={14} className="text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className="flex items-center gap-2"
          >
            <ChevronLeft size={16} />
            Previous
          </Button>
          
          <div className="text-center">
            <div className="text-sm text-slate-500 mb-1">
              {currentQuestionIndex + 1} of {questions.length}
            </div>
            <div className="flex gap-2">
              {questions.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full ${
                    index === currentQuestionIndex
                      ? 'bg-indigo-500'
                      : index < currentQuestionIndex
                      ? 'bg-green-500'
                      : 'bg-slate-300'
                  }`}
                />
              ))}
            </div>
          </div>

          <Button
            onClick={handleNext}
            disabled={!selectedOption}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700"
          >
            {currentQuestionIndex === questions.length - 1 ? 'Submit' : 'Next'}
            <ChevronRight size={16} />
          </Button>
        </div>

        {/* Instructions */}
        <div className="mt-12 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
            <Sparkles size={16} />
            Instructions
          </h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Select one answer for each question</li>
            <li>• You can navigate between questions using Previous/Next buttons</li>
            <li>• Timer will auto-submit when time runs out</li>
            <li>• Earn +5 coins for each correct answer</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PracticeSessionPage;