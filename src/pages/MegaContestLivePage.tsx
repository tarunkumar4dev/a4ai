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
  Eye,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

// Interface definitions
interface Question {
  id: string;
  question_number: number;
  question_text: string;
  options: string[];
  marks: number;
  subject: string;
  correct_answer: number;
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
  is_active: boolean;
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

interface Participant {
  id: string;
  contest_id: string;
  contest_code: string;
  user_id: string;
  started_at: string;
  finished_at: string | null;
  status: 'not_started' | 'in_progress' | 'completed';
  total_score: number | null;
  questions_attempted: number;
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
  const [initializing, setInitializing] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [stats, setStats] = useState<SubmissionStats>({
    totalParticipants: 0,
    userRank: 0,
    avgCompletion: 0
  });
  
  // Proctoring states
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabSwitchWarning, setShowTabSwitchWarning] = useState(false);
  const [isTestBlocked, setIsTestBlocked] = useState(false);
  const [contestStarted, setContestStarted] = useState(false);
  const [participantId, setParticipantId] = useState<string | null>(null);

  // Get user ID from session
  const userId = useMemo(() => session?.user?.id || null, [session]);

  // Memoized calculations
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const totalQuestions = useMemo(() => questions.length, [questions]);
  const progressPercentage = useMemo(() => 
    totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0
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
    if (!contestStarted || !contest?.is_active) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        const newCount = tabSwitchCount + 1;
        setTabSwitchCount(newCount);
        setShowTabSwitchWarning(true);
        
        // Save tab switch event
        if (userId && contestId) {
          supabase.from('mega_contest_proctoring_events').insert({
            user_id: userId,
            contest_id: contestId,
            event_type: 'tab_switch',
            event_data: { count: newCount }
          }).then(({ error }) => {
            if (error) console.error('Failed to log proctoring event:', error);
          });
        }
        
        setTimeout(() => {
          setShowTabSwitchWarning(false);
        }, 3000);
        
        // Block after 10 switches
        if (newCount >= 10) {
          setIsTestBlocked(true);
          toast.error('Test Terminated! You switched tabs too many times (10/10). This is considered cheating.');
          handleAutoSubmit();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [contestStarted, tabSwitchCount, contest?.is_active, userId, contestId]);

  // Initialize contest data
  useEffect(() => {
    const initializeContest = async () => {
      if (!contestId || !userId) return;

      try {
        setInitializing(true);

        // Check if contest exists and is active
        const { data: contestData, error: contestError } = await supabase
          .from('mega_contests')
          .select('*')
          .eq('id', contestId)
          .eq('is_active', true)
          .single();

        if (contestError || !contestData) {
          toast.error('Contest not found or inactive');
          navigate('/contests');
          return;
        }

        setContest(contestData);

        // Check if user has already attempted this contest
        const { data: existingParticipation, error: participationError } = await supabase
          .from('mega_contest_participants')
          .select('*')
          .eq('contest_id', contestId)
          .eq('user_id', userId)
          .single();

        if (existingParticipation?.status === 'completed') {
          toast.error('You have already completed this contest');
          navigate(`/contests/results/${contestId}`);
          return;
        }

        // Fetch questions
        const { data: questionsData, error: questionsError } = await supabase
          .from('mega_contest_questions')
          .select('*')
          .eq('contest_id', contestId)
          .order('question_number', { ascending: true });

        if (questionsError) {
          toast.error('Failed to load questions');
          throw questionsError;
        }

        if (!questionsData || questionsData.length === 0) {
          toast.error('No questions found for this contest');
          navigate('/contests');
          return;
        }

        setQuestions(questionsData);

        // Calculate initial time left
        if (existingParticipation?.started_at) {
          const startedAt = new Date(existingParticipation.started_at).getTime();
          const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
          const totalTime = contestData.duration_minutes * 60;
          const remaining = Math.max(0, totalTime - elapsedSeconds);
          setTimeLeft(remaining);
        } else {
          setTimeLeft(contestData.duration_minutes * 60);
        }

        // Load saved answers
        const { data: savedAnswers, error: answersError } = await supabase
          .from('mega_contest_submissions')
          .select('question_id, selected_option, created_at')
          .eq('contest_id', contestId)
          .eq('user_id', userId);

        if (!answersError && savedAnswers) {
          const answersMap: Record<string, UserAnswer> = {};
          savedAnswers.forEach(answer => {
            answersMap[answer.question_id] = {
              selectedIndex: answer.selected_option,
              timestamp: answer.created_at
            };
          });
          setAnswers(answersMap);
        }

        // Create or update participant record
        const participantData = {
          contest_id: contestId,
          user_id: userId,
          contest_code: contestData.code || contestId,
          started_at: existingParticipation?.started_at || new Date().toISOString(),
          status: existingParticipation?.status || 'in_progress',
          questions_attempted: Object.keys(answersMap).length
        };

        const { data: participant, error: upsertError } = await supabase
          .from('mega_contest_participants')
          .upsert(participantData, { 
            onConflict: 'contest_id,user_id',
            returning: 'representation'
          })
          .select()
          .single();

        if (upsertError) {
          console.error('Failed to create participant record:', upsertError);
        } else if (participant) {
          setParticipantId(participant.id);
        }

        // Load statistics
        await loadStatistics(contestId);

        setContestStarted(true);
        toast.success('Contest started! Good luck!');

      } catch (error) {
        console.error('Error initializing contest:', error);
        toast.error('Failed to initialize contest. Please try again.');
        navigate('/contests');
      } finally {
        setInitializing(false);
        setLoading(false);
      }
    };

    if (contestId && userId) {
      initializeContest();
    }
  }, [contestId, userId, navigate]);

  // Load statistics
  const loadStatistics = async (contestId: string) => {
    try {
      // Get total participants
      const { count: totalParticipants } = await supabase
        .from('mega_contest_participants')
        .select('*', { count: 'exact', head: true })
        .eq('contest_id', contestId);

      // Get user's rank (simplified - in production you'd want a more accurate calculation)
      const { data: allParticipants } = await supabase
        .from('mega_contest_participants')
        .select('user_id, total_score')
        .eq('contest_id', contestId)
        .order('total_score', { ascending: false });

      let userRank = 1;
      if (allParticipants && userId) {
        const sortedParticipants = allParticipants.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
        const rankIndex = sortedParticipants.findIndex(p => p.user_id === userId);
        userRank = rankIndex !== -1 ? rankIndex + 1 : sortedParticipants.length + 1;
      }

      // Calculate average completion (simplified)
      const { data: participants } = await supabase
        .from('mega_contest_participants')
        .select('questions_attempted')
        .eq('contest_id', contestId);

      let avgCompletion = 0;
      if (participants && participants.length > 0) {
        const totalAttempts = participants.reduce((sum, p) => sum + (p.questions_attempted || 0), 0);
        avgCompletion = Math.round((totalAttempts / (participants.length * totalQuestions)) * 100) || 0;
      }

      setStats({
        totalParticipants: totalParticipants || 0,
        userRank,
        avgCompletion
      });

    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0 || !contest?.is_active) {
      if (timeLeft <= 0) {
        handleAutoSubmit();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, contest?.is_active]);

  // Auto-save answers periodically
  useEffect(() => {
    if (!contestStarted || Object.keys(answers).length === 0 || !userId || !contestId) return;

    const autoSave = async () => {
      try {
        const savePromises = Object.entries(answers).map(([questionId, answer]) =>
          supabase
            .from('mega_contest_submissions')
            .upsert({
              contest_id: contestId,
              user_id: userId,
              question_id: questionId,
              selected_option: answer.selectedIndex,
              created_at: new Date().toISOString()
            }, { onConflict: 'contest_id,user_id,question_id' })
        );

        const results = await Promise.all(savePromises);
        const hasError = results.some(result => result.error);
        
        if (!hasError) {
          setLastSaved(new Date());
          
          // Update questions attempted count
          if (participantId) {
            await supabase
              .from('mega_contest_participants')
              .update({ questions_attempted: answeredCount })
              .eq('id', participantId);
          }
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    };

    const saveInterval = setInterval(autoSave, 30000); // Every 30 seconds
    return () => clearInterval(saveInterval);
  }, [answers, userId, contestId, contestStarted, answeredCount, participantId]);

  // Handle answer selection
  const handleAnswer = useCallback(async (questionId: string, selectedIndex: number) => {
    const updatedAnswer: UserAnswer = {
      selectedIndex,
      timestamp: new Date().toISOString()
    };

    setAnswers(prev => ({
      ...prev,
      [questionId]: updatedAnswer
    }));

    // Immediate save
    if (userId && contestId) {
      try {
        const { error } = await supabase
          .from('mega_contest_submissions')
          .upsert({
            contest_id: contestId,
            user_id: userId,
            question_id: questionId,
            selected_option: selectedIndex,
            created_at: new Date().toISOString()
          }, { onConflict: 'contest_id,user_id,question_id' });

        if (error) {
          console.error('Error saving answer:', error);
          toast.error('Failed to save answer');
        } else {
          setLastSaved(new Date());
          
          // Update participant's questions attempted count
          if (participantId) {
            const newCount = Object.keys({ ...answers, [questionId]: updatedAnswer }).length;
            await supabase
              .from('mega_contest_participants')
              .update({ questions_attempted: newCount })
              .eq('id', participantId);
          }
        }
      } catch (error) {
        console.error('Error saving answer:', error);
      }
    }
  }, [userId, contestId, answers, participantId]);

  // Auto submit when time ends
  const handleAutoSubmit = useCallback(async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    toast.info('Time is up! Submitting your test...');

    try {
      await submitTest('auto');
      toast.success('Test submitted automatically due to time limit');
      navigate(`/contests/results/${contestId}`);
    } catch (error) {
      console.error('Error in auto-submit:', error);
      toast.error('Failed to submit test. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [contestId, navigate, isSubmitting]);

  // Manual submit
  const handleManualSubmit = useCallback(async () => {
    if (isSubmitting) return;

    const confirmed = await new Promise(resolve => {
      toast.custom((t) => (
        <div className="w-full max-w-sm bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Submit Test</h3>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to submit? You cannot change answers after submission.
              </p>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    toast.dismiss(t);
                    resolve(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    toast.dismiss(t);
                    resolve(true);
                  }}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Submit Test
                </Button>
              </div>
            </div>
          </div>
        </div>
      ));
    });

    if (!confirmed) return;

    setIsSubmitting(true);
    toast.info('Submitting your test...');

    try {
      await submitTest('manual');
      toast.success('Test submitted successfully!');
      navigate(`/contests/results/${contestId}`);
    } catch (error) {
      console.error('Error submitting test:', error);
      toast.error('Failed to submit test. Please try again.');
      setIsSubmitting(false);
    }
  }, [contestId, navigate, isSubmitting]);

  // Submit test function
  const submitTest = async (type: 'auto' | 'manual') => {
    if (!userId || !contestId || !contest) return;

    try {
      // Calculate score
      let score = 0;
      const correctAnswers: string[] = [];

      questions.forEach(question => {
        const userAnswer = answers[question.id];
        if (userAnswer && userAnswer.selectedIndex === question.correct_answer) {
          score += question.marks;
          correctAnswers.push(question.id);
        }
      });

      // Update participant record
      const updateData: any = {
        finished_at: new Date().toISOString(),
        status: 'completed',
        total_score: score,
        questions_attempted: answeredCount,
        time_taken: contest.duration_minutes * 60 - timeLeft
      };

      const { error: updateError } = await supabase
        .from('mega_contest_participants')
        .update(updateData)
        .eq('contest_id', contestId)
        .eq('user_id', userId);

      if (updateError) {
        throw updateError;
      }

      // Log submission event
      await supabase.from('mega_contest_submission_events').insert({
        user_id: userId,
        contest_id: contestId,
        submission_type: type,
        score: score,
        time_taken: updateData.time_taken
      });

      console.log(`✅ Test submitted (${type}) with score:`, score);
      return score;

    } catch (error) {
      console.error('Error in submitTest:', error);
      throw error;
    }
  };

  const handleQuestionSelect = useCallback((index: number) => {
    setCurrentIndex(index);
    setShowMobileSidebar(false);
  }, []);

  const getDifficultyColor = useCallback((difficulty?: string) => {
    switch (difficulty) {
      case 'easy': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'hard': return 'text-rose-600 bg-rose-50 border-rose-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  }, []);

  // Loading state
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-24 h-24 border-4 border-gray-200 rounded-full"></div>
            <div className="absolute top-0 left-0 w-24 h-24 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-gray-800">Loading Contest</h3>
            <p className="text-sm text-gray-600">Preparing your test environment...</p>
            <p className="text-xs text-gray-500">Please don't refresh the page</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
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
              <p className="text-gray-600">The requested contest could not be loaded or is no longer active.</p>
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
                onClick={() => {
                  if (window.confirm('Are you sure you want to leave? Your progress will be saved.')) {
                    navigate('/contests');
                  }
                }}
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
                className="hidden sm:flex bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white shadow-md"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
              className="bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white shadow-md"
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
                    <span>{progressPercentage}% Complete</span>
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
                            shadow-sm
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
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {currentQuestion?.subject || 'General'}
                      </Badge>
                      {currentQuestion?.difficulty && (
                        <Badge variant="outline" className={getDifficultyColor(currentQuestion.difficulty)}>
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
                          shadow-sm
                          ${isSelected
                            ? 'border-blue-500 bg-blue-50 shadow-md'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`
                            w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold transition-all
                            shadow-sm
                            ${isSelected
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-700'
                            }
                          `}>
                            {optionLetter}
                          </div>
                          <span className="flex-1 text-gray-900">{option}</span>
                          {isSelected && (
                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
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
                      className="bg-gray-900 hover:bg-gray-800 text-white gap-2 shadow-md"
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
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Flag className="h-5 w-5 mr-2" />
                )}
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
                      {progressPercentage}% Complete
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
                              shadow-sm
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
                  className="w-full bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white shadow-md"
                  size="lg"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <Flag className="h-5 w-5 mr-2" />
                  )}
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