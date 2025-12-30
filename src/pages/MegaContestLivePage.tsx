import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/providers/AuthProvider';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Flag,
  BarChart,
  Users,
  Menu,
  X,
  BookOpen,
  Save,
  AlertTriangle,
  Eye
} from 'lucide-react';

// Interface definitions
interface Question {
  id: string;
  question_number: number;
  question_text: string;
  options: string[];
  marks: number;
  subject: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

interface Contest {
  id: string;
  title: string;
  class: string;
  subjects: string[];
  end_time: string;
  duration_minutes: number;
  total_marks: number;
  total_questions: number;
}

interface UserAnswer {
  selectedIndex: number;
  timestamp: string;
}

interface SubmissionStats {
  totalParticipants: number;
  userRank: number;
  avgCompletion: number;
}

const MegaContestLivePage: React.FC = () => {
  const { contestId } = useParams<{ contestId: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  
  const [contest, setContest] = useState<Contest | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(10800);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [stats, setStats] = useState<SubmissionStats>({
    totalParticipants: 1247,
    userRank: 42,
    avgCompletion: 68
  });
  
  // NEW STATES FOR PROCTORING
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabSwitchWarning, setShowTabSwitchWarning] = useState(false);
  const [isTestBlocked, setIsTestBlocked] = useState(false);
  const [contestStarted, setContestStarted] = useState(false);

  // Get user ID from session
  const userId = useMemo(() => session?.user?.id || null, [session]);

  // Memoized calculations
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const totalQuestions = useMemo(() => questions.length, [questions]);
  const progressPercentage = useMemo(() => 
    totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0
  , [answeredCount, totalQuestions]);
  const currentQuestion = useMemo(() => questions[currentIndex], [questions, currentIndex]);
  const userAnswer = useMemo(() => 
    currentQuestion ? answers[currentQuestion.id] : undefined
  , [currentQuestion, answers]);

  // Format time display
  const formatTime = useCallback((seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Get time status color
  const getTimeStatusColor = useCallback((seconds: number): string => {
    if (seconds < 300) return 'text-red-600 animate-pulse';
    if (seconds < 900) return 'text-amber-600';
    return 'text-emerald-600';
  }, []);

  // Tab switching detection
  useEffect(() => {
    if (!contestStarted) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User switched tab
        const newCount = tabSwitchCount + 1;
        setTabSwitchCount(newCount);
        setShowTabSwitchWarning(true);
        
        // Show warning for 3 seconds
        setTimeout(() => {
          setShowTabSwitchWarning(false);
        }, 3000);
        
        // Block after 10 switches
        if (newCount >= 10) {
          setIsTestBlocked(true);
          alert('❌ Test Terminated! You switched tabs too many times (10/10). This is considered cheating.');
          handleAutoSubmit();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [contestStarted, tabSwitchCount]);

  // Initialize contest data
  useEffect(() => {
    const initializeContest = async () => {
      try {
        // Check if user is logged in
        if (!userId) {
          alert('Please login to attempt the contest');
          navigate('/login');
          return;
        }

        // ✅ CHECK IF USER ALREADY ATTEMPTED THIS CONTEST - FIXED
        const { data: existingParticipation } = await supabase
          .from('mega_contest_participants')
          .select('finished_at')
          .eq('contest_code', contestId)
          .eq('user_id', userId)
          .single();

        // If user already completed
        if (existingParticipation && existingParticipation.finished_at) {
          navigate('/contests/already-attempted');
          return;
        }

        // Fetch contest data
        const [contestResponse, questionsResponse] = await Promise.all([
          supabase
            .from('mega_contests')
            .select('*')
            .eq('id', contestId)
            .single(),
          supabase
            .from('mega_contest_questions')
            .select('*')
            .eq('contest_id', contestId)
            .order('question_number', { ascending: true })
        ]);

        if (contestResponse.data) {
          setContest(contestResponse.data);
          // Set initial time based on contest duration
          if (contestResponse.data.duration_minutes) {
            setTimeLeft(contestResponse.data.duration_minutes * 60);
          }
        }

        if (questionsResponse.data && questionsResponse.data.length > 0) {
          setQuestions(questionsResponse.data);
        }

        // ✅ Load saved answers - FIXED column names
        const { data: savedAnswers } = await supabase
          .from('mega_contest_submissions')
          .select('question_id, selected_answer, submitted_at')
          .eq('user_id', userId)
          .eq('contest_code', contestId);

        if (savedAnswers) {
          const answersMap: Record<string, UserAnswer> = {};
          savedAnswers.forEach(answer => {
            answersMap[answer.question_id] = {
              selectedIndex: answer.selected_answer,
              timestamp: answer.submitted_at
            };
          });
          setAnswers(answersMap);
        }

        // Mark contest as started
        setContestStarted(true);
        
        // ✅ INSERT USER PARTICIPATION RECORD IF NOT EXISTS - FIXED
        await supabase
          .from('mega_contest_participants')
          .upsert({
            contest_code: contestId,
            user_id: userId,
            started_at: new Date().toISOString(),
            status: 'in_progress'
          }, { onConflict: 'contest_code,user_id' });
        
      } catch (error) {
        console.error('Error initializing contest:', error);
      } finally {
        setLoading(false);
      }
    };

    if (contestId && userId) {
      initializeContest();
    }
  }, [contestId, userId, navigate]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) {
      handleAutoSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // ✅ Auto-save answers periodically - FIXED
  useEffect(() => {
    if (Object.keys(answers).length === 0 || !userId || !contestId) return;

    const autoSave = async () => {
      try {
        const savePromises = Object.entries(answers).map(([questionId, answer]) =>
          supabase
            .from('mega_contest_submissions')
            .upsert({
              contest_code: contestId, // ✅ FIXED: contest_id → contest_code
              user_id: userId,
              question_id: questionId,
              selected_answer: answer.selectedIndex,
              submitted_at: new Date().toISOString() // ✅ FIXED: updated_at → submitted_at
            }, { onConflict: 'contest_code,user_id,question_id' })
        );

        await Promise.all(savePromises);
        setLastSaved(new Date());
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    };

    const saveInterval = setInterval(autoSave, 30000);
    return () => clearInterval(saveInterval);
  }, [answers, userId, contestId]);

  // ✅ Handle answer selection - FIXED
  const handleAnswer = useCallback(async (questionId: string, selectedIndex: number) => {
    const updatedAnswer: UserAnswer = {
      selectedIndex,
      timestamp: new Date().toISOString()
    };

    setAnswers(prev => ({
      ...prev,
      [questionId]: updatedAnswer
    }));

    // Immediate save if user is logged in
    if (userId && contestId) {
      try {
        await supabase
          .from('mega_contest_submissions')
          .upsert({
            contest_code: contestId, // ✅ FIXED: contest_id → contest_code
            user_id: userId,
            question_id: questionId,
            selected_answer: selectedIndex,
            submitted_at: new Date().toISOString() // ✅ FIXED: updated_at → submitted_at
          }, { onConflict: 'contest_code,user_id,question_id' });
        setLastSaved(new Date());
      } catch (error) {
        console.error('Error saving answer:', error);
      }
    }
  }, [userId, contestId]);

  // ✅ Auto submit when time ends - FIXED
  const handleAutoSubmit = useCallback(async () => {
    setIsSubmitting(true);
    if (userId && contestId) {
      await supabase
        .from('mega_contest_participants')
        .upsert({
          contest_code: contestId, // ✅ FIXED: contest_id → contest_code
          user_id: userId,
          finished_at: new Date().toISOString(),
          status: 'completed'
        }, { onConflict: 'contest_code,user_id' });
    }
    
    alert('Time is up! Your test has been submitted automatically.');
    navigate('/contests/results/' + contestId);
  }, [userId, contestId, navigate]);

  // ✅ Manual submit - FIXED
  const handleManualSubmit = useCallback(async () => {
    if (!window.confirm('Are you sure you want to submit? You cannot change answers after submission.')) {
      return;
    }

    setIsSubmitting(true);
    
    if (userId && contestId) {
      try {
        // ✅ Calculate score before submitting
        const { data: questionsData } = await supabase
          .from('mega_contest_questions')
          .select('id, correct_answer')
          .eq('contest_id', contestId);

        let score = 0;
        if (questionsData) {
          questionsData.forEach(question => {
            const userAnswer = answers[question.id];
            if (userAnswer && userAnswer.selectedIndex === question.correct_answer) {
              score += 4; // Assuming 4 marks per question
            }
          });
        }

        // ✅ Update participant record with score - FIXED
        await supabase
          .from('mega_contest_participants')
          .upsert({
            contest_code: contestId, // ✅ FIXED: contest_id → contest_code
            user_id: userId,
            finished_at: new Date().toISOString(),
            status: 'completed',
            score: score,
            time_taken: contest?.duration_minutes ? (contest.duration_minutes * 60 - timeLeft) : 0
          }, { onConflict: 'contest_code,user_id' });
        
        console.log('✅ Test submitted with score:', score);
      } catch (error) {
        console.error('Error submitting contest:', error);
      }
    }
    
    alert('Test submitted successfully! Results will be available soon.');
    navigate('/contests');
  }, [userId, contestId, answers, contest, timeLeft, navigate]);

  const handleQuestionSelect = useCallback((index: number) => {
    setCurrentIndex(index);
    setShowMobileSidebar(false);
  }, []);

  const getDifficultyColor = useCallback((difficulty?: string) => {
    switch (difficulty) {
      case 'easy': return 'text-emerald-600 bg-emerald-50';
      case 'medium': return 'text-amber-600 bg-amber-50';
      case 'hard': return 'text-rose-600 bg-rose-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-gray-200 rounded-full"></div>
            <div className="absolute top-0 left-0 w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Loading Contest</h3>
            <p className="text-sm text-gray-600">Preparing your test environment...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <Card className="max-w-md w-full mx-4 shadow-lg">
          <CardContent className="p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-3 bg-rose-50 rounded-full">
                <AlertCircle className="h-12 w-12 text-rose-500" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">Contest Not Found</h2>
              <p className="text-gray-600">The requested contest could not be loaded.</p>
            </div>
            <Button 
              onClick={() => navigate('/contests')}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white"
            >
              Back to Contests
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isTestBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <Card className="max-w-md w-full mx-4 shadow-lg">
          <CardContent className="p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-3 bg-red-50 rounded-full">
                <AlertTriangle className="h-12 w-12 text-red-500" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">Test Terminated</h2>
              <p className="text-gray-600">Your test has been terminated due to multiple tab switches (10/10).</p>
              <p className="text-sm text-gray-500">This is considered as cheating.</p>
            </div>
            <Button 
              onClick={() => navigate('/contests')}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white"
            >
              Back to Contests
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Tab Switch Warning */}
      {showTabSwitchWarning && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-pulse">
          <div className="bg-red-500 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <span className="font-bold">Warning!</span> Tab switch detected ({tabSwitchCount}/10).
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/contests')}
                className="hidden sm:flex"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              
              <div className="border-l border-gray-200 pl-4">
                <h1 className="text-lg font-bold text-gray-900 truncate max-w-[200px] sm:max-w-none">
                  {contest.title}
                </h1>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <BookOpen className="h-3 w-3" />
                  <span>Class {contest.class}</span>
                  <span>•</span>
                  <span>{contest.total_questions} Questions</span>
                  <span>•</span>
                  <span>{contest.total_marks} Marks</span>
                  <span>•</span>
                  <span className="flex items-center text-red-500">
                    <Eye className="h-3 w-3 mr-1" />
                    Proctored
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Timer Display */}
              <div className={`hidden sm:flex items-center space-x-2 px-3 py-2 rounded-lg ${timeLeft < 300 ? 'bg-red-50' : 'bg-gray-50'}`}>
                <Clock className={`h-4 w-4 ${getTimeStatusColor(timeLeft)}`} />
                <span className={`font-mono font-bold ${getTimeStatusColor(timeLeft)}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden"
                onClick={() => setShowMobileSidebar(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>

              {/* Submit Button - Desktop */}
              <Button
                onClick={handleManualSubmit}
                disabled={isSubmitting}
                className="hidden sm:flex bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Flag className="h-4 w-4 mr-2" />
                    Submit Test
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Timer Bar */}
      <div className="sm:hidden sticky top-16 z-40 bg-white border-b border-gray-200">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <div className={`flex items-center space-x-2 ${timeLeft < 300 ? 'animate-pulse' : ''}`}>
              <Clock className={`h-4 w-4 ${getTimeStatusColor(timeLeft)}`} />
              <span className={`font-mono font-bold ${getTimeStatusColor(timeLeft)}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
            <Button
              onClick={handleManualSubmit}
              disabled={isSubmitting}
              size="sm"
              className="bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white"
            >
              <Flag className="h-4 w-4 mr-1" />
              Submit
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Question Palette (Desktop) */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-32 space-y-6">
              {/* Progress Card */}
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 flex items-center">
                      <BarChart className="h-4 w-4 mr-2 text-blue-600" />
                      Progress
                    </h3>
                    <span className="text-sm font-medium text-blue-600">
                      {answeredCount}/{totalQuestions}
                    </span>
                  </div>
                  
                  <Progress 
                    value={progressPercentage} 
                    className="h-2 mb-3"
                  />
                  
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>{Math.round(progressPercentage)}% Complete</span>
                    {lastSaved && (
                      <span className="flex items-center text-gray-500">
                        <Save className="h-3 w-3 mr-1" />
                        Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Questions Grid */}
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-gray-900 mb-4">Questions</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {questions.map((question, index) => {
                      const isAnswered = answers[question.id];
                      const isCurrent = index === currentIndex;
                      
                      return (
                        <button
                          key={question.id}
                          onClick={() => handleQuestionSelect(index)}
                          className={`
                            relative h-10 rounded-lg flex items-center justify-center font-medium text-sm transition-all
                            ${isCurrent 
                              ? 'bg-blue-600 text-white ring-2 ring-blue-500 ring-offset-1' 
                              : isAnswered
                              ? 'bg-blue-100 text-blue-700 border border-blue-300'
                              : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                            }
                          `}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Legend */}
                  <div className="mt-6 pt-5 border-t border-gray-100 space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded bg-blue-100 border border-blue-300 mr-2"></div>
                        <span>Attempted</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded bg-gray-100 border border-gray-300 mr-2"></div>
                        <span>Unattempted</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stats Card */}
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-gray-900 flex items-center mb-4">
                    <Users className="h-4 w-4 mr-2 text-blue-600" />
                    Live Statistics
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Participants</span>
                      <span className="font-semibold text-gray-900">{stats.totalParticipants.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Your Position</span>
                      <span className="font-semibold text-blue-600">#{stats.userRank}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Avg. Completion</span>
                      <span className="font-semibold text-gray-900">{stats.avgCompletion}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Question Area */}
          <div className="lg:col-span-2">
            <Card className="border-gray-200 shadow-sm h-full">
              <CardContent className="p-6">
                {/* Question Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                        {currentQuestion?.subject || 'General'}
                      </Badge>
                      {currentQuestion?.difficulty && (
                        <Badge className={getDifficultyColor(currentQuestion.difficulty)}>
                          {currentQuestion.difficulty.charAt(0).toUpperCase() + currentQuestion.difficulty.slice(1)}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      Question {currentQuestion?.question_number || 0} of {totalQuestions}
                      <span className="mx-2">•</span>
                      <span className="font-semibold text-gray-900">{currentQuestion?.marks || 4} Points</span>
                    </div>
                  </div>
                  <div className="text-lg font-bold text-gray-900">
                    #{currentQuestion?.question_number || 0}
                  </div>
                </div>

                {/* Question Text */}
                <div className="mb-8">
                  <div className="prose prose-gray max-w-none">
                    <h2 className="text-lg font-semibold text-gray-900 leading-relaxed mb-6">
                      {currentQuestion?.question_text || 'Loading question...'}
                    </h2>
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-3 mb-8">
                  {currentQuestion?.options?.map((option, index) => {
                    const isSelected = userAnswer?.selectedIndex === index;
                    const optionLetter = String.fromCharCode(65 + index);
                    
                    return (
                      <button
                        key={index}
                        onClick={() => handleAnswer(currentQuestion.id, index)}
                        disabled={isSubmitting}
                        className={`
                          w-full p-4 text-left rounded-xl border-2 transition-all duration-200
                          ${isSelected
                            ? 'border-blue-500 bg-blue-50 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`
                            w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold transition-all
                            ${isSelected
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-700'
                            }
                          `}>
                            {optionLetter}
                          </div>
                          <span className="flex-1 text-gray-900">{option}</span>
                          {isSelected && (
                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                              <div className="w-2 h-2 rounded-full bg-white"></div>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Navigation */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-gray-100">
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                    <span>Click to select answer</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentIndex === 0 || isSubmitting}
                      variant="outline"
                      className="gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    
                    <Button
                      onClick={() => setCurrentIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
                      disabled={currentIndex === totalQuestions - 1 || isSubmitting}
                      className="bg-gray-900 hover:bg-gray-800 text-white gap-2"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar - Instructions (Desktop) */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-32 space-y-6">
              {/* Proctoring Warning Card */}
              <Card className="border-red-200 bg-red-50 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <Eye className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <h4 className="font-semibold text-red-900">⚠️ STRICT PROCTORING ACTIVE</h4>
                      <p className="text-sm text-red-700">
                        • Your actions are being monitored<br/>
                        • Tab switching is limited to 10 times<br/>
                        • Do not switch tabs/windows<br/>
                        • Cheating = Test Termination<br/>
                        • Tab switches: {tabSwitchCount}/10
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Instructions Card */}
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-gray-900 mb-4">Instructions</h3>
                  <ul className="space-y-3 text-sm text-gray-600">
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-blue-600">1</span>
                      </div>
                      <span>Each question has 4 options. Select only one.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-blue-600">2</span>
                      </div>
                      <span>Answers auto-save every 30 seconds.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-blue-600">3</span>
                      </div>
                      <span>Navigate freely between questions.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-blue-600">4</span>
                      </div>
                      <span>Submit before timer reaches zero.</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Warning Card */}
              <Card className="border-amber-200 bg-amber-50 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <h4 className="font-semibold text-amber-900">Important Notice</h4>
                      <p className="text-sm text-amber-700">
                        Results will be calculated after all participants complete the test. 
                        No instant feedback is provided during the contest.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Final Submit Button */}
              <Button
                onClick={handleManualSubmit}
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white shadow-md"
                size="lg"
              >
                <Flag className="h-5 w-5 mr-2" />
                {isSubmitting ? 'Submitting...' : 'Final Submit'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMobileSidebar(true)}
              className="flex items-center gap-2"
            >
              <BarChart className="h-4 w-4" />
              <span className="font-medium">{answeredCount}/{totalQuestions}</span>
            </Button>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                variant="outline"
                size="icon"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="text-sm font-medium text-gray-900">
                {currentIndex + 1}/{totalQuestions}
              </div>
              
              <Button
                onClick={() => setCurrentIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
                disabled={currentIndex === totalQuestions - 1}
                variant="outline"
                size="icon"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowMobileSidebar(false)}
          />
          
          <div className="absolute inset-y-0 left-0 w-80 bg-white shadow-xl">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="font-bold text-gray-900">Test Navigator</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowMobileSidebar(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Proctoring Warning */}
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      <Eye className="h-4 w-4 text-red-600 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-red-900 text-sm">PROCTORING ACTIVE</h4>
                        <p className="text-xs text-red-700">
                          Tab switches: {tabSwitchCount}/10<br/>
                          Do not switch tabs
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">Progress</h3>
                      <span className="text-sm font-medium text-blue-600">
                        {answeredCount}/{totalQuestions}
                      </span>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                    <div className="mt-2 text-sm text-gray-600">
                      {Math.round(progressPercentage)}% Complete
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Questions</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {questions.map((question, index) => {
                        const isAnswered = answers[question.id];
                        const isCurrent = index === currentIndex;
                        
                        return (
                          <button
                            key={question.id}
                            onClick={() => handleQuestionSelect(index)}
                            className={`
                              h-10 rounded-lg flex items-center justify-center font-medium text-sm
                              ${isCurrent 
                                ? 'bg-blue-600 text-white' 
                                : isAnswered
                                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                : 'bg-gray-100 text-gray-700 border border-gray-200'
                              }
                            `}
                          >
                            {index + 1}
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Quick Instructions</h3>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-semibold text-blue-600">✓</span>
                        </div>
                        <span>Select one answer per question</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-semibold text-blue-600">⌛</span>
                        </div>
                        <span>Answers auto-save</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-semibold text-blue-600">⚠️</span>
                        </div>
                        <span>No instant results</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
                
                <Button
                  onClick={handleManualSubmit}
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white"
                  size="lg"
                >
                  <Flag className="h-5 w-5 mr-2" />
                  {isSubmitting ? 'Submitting...' : 'Submit Test'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Low Time Warning */}
      {timeLeft > 0 && timeLeft <= 300 && (
        <div className="fixed bottom-20 right-4 animate-bounce z-40">
          <div className="bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold">
              {timeLeft <= 60 
                ? `${timeLeft} seconds remaining!` 
                : `${Math.ceil(timeLeft / 60)} minutes remaining!`
              }
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MegaContestLivePage;