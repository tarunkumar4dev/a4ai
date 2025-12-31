import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  CheckCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

// Interface definitions
interface Question {
  id: string;
  question_order: number;
  question_text: string;
  options: { [key: string]: string };
  correct_answer: string;
  marks: number;
  subject: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  negative_marks: number;
  contest_id: string;
}

interface Contest {
  id: string;
  contest_code: string;
  title: string;
  class: string;
  subjects: string[];
  start_time: string;
  end_time: string;
  duration_minutes?: number;
  total_questions?: number;
  total_marks?: number;
}

interface UserAnswer {
  selected_answer: string;
  submitted_at: string;
}

interface SubmissionStats {
  totalParticipants: number;
  userRank: number;
  avgCompletion: number;
}

interface ParticipantRecord {
  id: string;
  contest_id: string;
  user_id: string;
  registration_time: string;
  status: string;
  score?: number;
  time_taken?: number;
}

const MegaContestLivePage: React.FC = () => {
  const { contestId } = useParams<{ contestId: string }>();
  const navigate = useNavigate();
  const { session, userProfile } = useAuth();
  
  const [contest, setContest] = useState<Contest | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
  const [loading, setLoading] = useState(true);
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
  const [isContestValid, setIsContestValid] = useState(true);
  const [participationChecked, setParticipationChecked] = useState(false);

  // Refs
  const autoSaveInterval = useRef<NodeJS.Timeout>();
  const timerInterval = useRef<NodeJS.Timeout>();
  const hasInitialized = useRef(false);
  const isSubmittingRef = useRef(false);

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
    if (!contestStarted || isTestBlocked) return;

    const handleVisibilityChange = () => {
      if (document.hidden && participantId) {
        // User switched tab
        const newCount = tabSwitchCount + 1;
        setTabSwitchCount(newCount);
        setShowTabSwitchWarning(true);
        
        // Log proctoring event (simplified - remove if table doesn't exist)
        const proctoringData = {
          participant_id: participantId,
          event_type: 'tab_switch',
          severity: newCount >= 5 ? 'high' : 'medium',
          details: { count: newCount, timestamp: new Date().toISOString() }
        };
        
        // Try to log event, but don't crash if table doesn't exist
        supabase.from('proctoring_events').insert(proctoringData).then(({ error }) => {
          if (error && !error.message.includes('does not exist')) {
            console.error('Error logging proctoring event:', error);
          }
        }).catch(() => {
          // Silently fail if table doesn't exist
        });
        
        // Show warning for 3 seconds
        const warningTimeout = setTimeout(() => {
          setShowTabSwitchWarning(false);
        }, 3000);
        
        // Block after 10 switches
        if (newCount >= 10) {
          setIsTestBlocked(true);
          toast.error('Test Terminated! You switched tabs too many times (10/10).');
          handleAutoSubmit();
        }

        return () => clearTimeout(warningTimeout);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [contestStarted, tabSwitchCount, participantId, isTestBlocked]);

  // Initialize contest data
  useEffect(() => {
    if (hasInitialized.current || !contestId || !userId) return;
    
    const initializeContest = async () => {
      try {
        hasInitialized.current = true;
        
        // Check if user is logged in
        if (!userId) {
          toast.error('Please login to attempt the contest');
          navigate('/login');
          return;
        }

        let contestData: Contest | null = null;
        
        // Try to fetch contest by contest_code first
        const { data: contestByCode, error: codeError } = await supabase
          .from('mega_contests')
          .select('*')
          .eq('contest_code', contestId)
          .maybeSingle();

        if (!codeError && contestByCode) {
          contestData = contestByCode;
        } else {
          // Try by ID as fallback
          const { data: contestById, error: idError } = await supabase
            .from('mega_contests')
            .select('*')
            .eq('id', contestId)
            .maybeSingle();
          
          if (idError || !contestById) {
            toast.error('Contest not found');
            setIsContestValid(false);
            setLoading(false);
            return;
          }
          
          contestData = contestById;
        }

        if (!contestData) {
          toast.error('Contest not found');
          setIsContestValid(false);
          setLoading(false);
          return;
        }

        setContest(contestData);
        
        // Check contest time
        const now = new Date();
        const startTime = new Date(contestData.start_time);
        const endTime = new Date(contestData.end_time);
        
        if (now < startTime) {
          toast.error('Contest has not started yet');
          navigate('/contests');
          return;
        }
        
        if (now > endTime) {
          toast.error('Contest has ended');
          navigate(`/contests/results/${contestData.contest_code}`);
          return;
        }
        
        // Calculate initial time left
        const timeDiff = Math.floor((endTime.getTime() - now.getTime()) / 1000);
        setTimeLeft(Math.max(0, timeDiff));

        // Check if user already participated in this contest
        const { data: existingParticipation, error: participationError } = await supabase
          .from('mega_contest_participants')
          .select('id, status')
          .eq('contest_id', contestData.id)
          .eq('user_id', userId)
          .maybeSingle();

        if (existingParticipation) {
          setParticipantId(existingParticipation.id);
          
          // If already completed, redirect to results
          if (existingParticipation.status === 'completed') {
            toast.error('You have already attempted this contest');
            navigate(`/contests/results/${contestData.contest_code}`);
            return;
          }
        }

        // Fetch questions
        const { data: questionsData, error: questionsError } = await supabase
          .from('mega_contest_questions')
          .select('*')
          .eq('contest_id', contestData.id)
          .order('question_order', { ascending: true });

        if (questionsError) {
          console.error('Error fetching questions:', questionsError);
          toast.error('Failed to load questions');
        } else if (questionsData) {
          setQuestions(questionsData);
        }

        // Load saved answers if participant exists
        if (participantId) {
          const { data: savedAnswers, error: answersError } = await supabase
            .from('mega_contest_submissions')
            .select('question_id, selected_answer, submitted_at')
            .eq('participant_id', participantId);

          if (!answersError && savedAnswers) {
            const answersMap: Record<string, UserAnswer> = {};
            savedAnswers.forEach(answer => {
              answersMap[answer.question_id] = {
                selected_answer: answer.selected_answer,
                submitted_at: answer.submitted_at
              };
            });
            setAnswers(answersMap);
          }
        } else {
          // Create new participation record
          try {
            const { data: newParticipation, error: insertError } = await supabase
              .from('mega_contest_participants')
              .insert({
                contest_id: contestData.id,
                user_id: userId,
                registration_time: new Date().toISOString(),
                status: 'in_progress'
              })
              .select()
              .single();

            if (insertError) {
              // If duplicate, try to fetch existing
              if (insertError.code === '23505') {
                const { data: existingRecord } = await supabase
                  .from('mega_contest_participants')
                  .select('id')
                  .eq('contest_id', contestData.id)
                  .eq('user_id', userId)
                  .single();
                
                if (existingRecord) {
                  setParticipantId(existingRecord.id);
                }
              } else {
                // Try simple insert as fallback
                const { error: simpleError } = await supabase
                  .from('mega_contest_participants')
                  .insert({
                    contest_id: contestData.id,
                    user_id: userId,
                    registration_time: new Date().toISOString(),
                    status: 'in_progress'
                  });
                
                if (!simpleError) {
                  // Fetch the newly created record
                  const { data: finalCheck } = await supabase
                    .from('mega_contest_participants')
                    .select('id')
                    .eq('contest_id', contestData.id)
                    .eq('user_id', userId)
                    .single();
                  
                  if (finalCheck) {
                    setParticipantId(finalCheck.id);
                  }
                }
              }
            } else if (newParticipation) {
              setParticipantId(newParticipation.id);
            }
          } catch (error: any) {
            console.error('Error creating participation:', error);
            toast.error('Failed to register for contest');
            navigate('/contests');
            return;
          }
        }

        // Fetch participant count
        try {
          const { count: participantCount, error: countError } = await supabase
            .from('mega_contest_participants')
            .select('*', { count: 'exact', head: true })
            .eq('contest_id', contestData.id);

          if (!countError) {
            setStats(prev => ({
              ...prev,
              totalParticipants: participantCount || 0
            }));
          }
        } catch (error) {
          console.error('Error fetching stats:', error);
        }

        // Mark contest as started
        setContestStarted(true);
        setParticipationChecked(true);
        
      } catch (error) {
        console.error('Error initializing contest:', error);
        toast.error('Failed to load contest');
        setIsContestValid(false);
      } finally {
        setLoading(false);
      }
    };

    initializeContest();

    return () => {
      hasInitialized.current = false;
    };
  }, [contestId, userId, navigate]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0 || !contestStarted) return;

    timerInterval.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, [timeLeft, contestStarted]);

  // Auto-save answers periodically
  useEffect(() => {
    if (Object.keys(answers).length === 0 || !participantId || !contest?.id || isSubmittingRef.current) return;

    const autoSave = async () => {
      try {
        const savePromises = Object.entries(answers).map(([questionId, answer]) =>
          supabase
            .from('mega_contest_submissions')
            .upsert({
              participant_id: participantId,
              contest_id: contest.id,
              question_id: questionId,
              selected_answer: answer.selected_answer,
              submitted_at: answer.submitted_at
            }, { onConflict: 'participant_id,question_id' })
        );

        await Promise.all(savePromises);
        setLastSaved(new Date());
        
        // Optional: Log save event if table exists
        try {
          await supabase.from('submission_events').insert({
            participant_id: participantId,
            action: 'auto_save',
            event_time: new Date().toISOString()
          });
        } catch (e) {
          // Silently fail if table doesn't exist
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    };

    autoSaveInterval.current = setInterval(autoSave, 30000);

    return () => {
      if (autoSaveInterval.current) {
        clearInterval(autoSaveInterval.current);
      }
    };
  }, [answers, participantId, contest?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveInterval.current) clearInterval(autoSaveInterval.current);
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, []);

  // Handle answer selection
  const handleAnswer = useCallback(async (questionId: string, answer: string) => {
    if (!participantId || !contest?.id || isSubmittingRef.current) return;

    const updatedAnswer: UserAnswer = {
      selected_answer: answer,
      submitted_at: new Date().toISOString()
    };

    setAnswers(prev => ({
      ...prev,
      [questionId]: updatedAnswer
    }));

    // Immediate save
    try {
      const { error } = await supabase
        .from('mega_contest_submissions')
        .upsert({
          participant_id: participantId,
          contest_id: contest.id,
          question_id: questionId,
          selected_answer: answer,
          submitted_at: updatedAnswer.submitted_at
        }, { onConflict: 'participant_id,question_id' });
      
      if (error) {
        console.error('Error saving answer:', error);
        toast.error('Failed to save answer');
      } else {
        setLastSaved(new Date());
      }
    } catch (error) {
      console.error('Error saving answer:', error);
      toast.error('Failed to save answer');
    }
  }, [participantId, contest?.id]);

  // Auto submit when time ends
  const handleAutoSubmit = useCallback(async () => {
    if (isSubmittingRef.current) return;
    
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    toast.info('Time is up! Submitting your test...');
    
    try {
      if (participantId && contest) {
        // Calculate score
        let score = 0;
        let totalCorrect = 0;
        
        questions.forEach(question => {
          const userAnswer = answers[question.id];
          if (userAnswer) {
            if (userAnswer.selected_answer === question.correct_answer) {
              score += question.marks;
              totalCorrect++;
            } else if (userAnswer.selected_answer && userAnswer.selected_answer !== '') {
              score -= question.negative_marks;
            }
          }
        });

        // Update participant record
        const updateData = {
          status: 'completed',
          score: score,
          time_taken: contest.duration_minutes ? (contest.duration_minutes * 60 - timeLeft) : 0
        };
        
        await supabase
          .from('mega_contest_participants')
          .update(updateData)
          .eq('id', participantId);
          
      }
    } catch (error) {
      console.error('Error auto-submitting contest:', error);
    } finally {
      setTimeout(() => {
        navigate(`/contests/results/${contest?.contest_code || contestId}`);
      }, 2000);
    }
  }, [participantId, answers, questions, contest, timeLeft, contestId, navigate]);

  // Manual submit
  const handleManualSubmit = useCallback(async () => {
    if (isSubmittingRef.current) return;
    
    if (!window.confirm('Are you sure you want to submit? You cannot change answers after submission.')) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    toast.info('Submitting your test...');
    
    try {
      if (participantId && contest) {
        // Calculate score
        let score = 0;
        let totalCorrect = 0;
        
        questions.forEach(question => {
          const userAnswer = answers[question.id];
          if (userAnswer) {
            if (userAnswer.selected_answer === question.correct_answer) {
              score += question.marks;
              totalCorrect++;
            } else if (userAnswer.selected_answer && userAnswer.selected_answer !== '') {
              score -= question.negative_marks;
            }
          }
        });

        // Update participant record
        const updateData = {
          status: 'completed',
          score: score,
          time_taken: contest.duration_minutes ? (contest.duration_minutes * 60 - timeLeft) : 0
        };
        
        const { error } = await supabase
          .from('mega_contest_participants')
          .update(updateData)
          .eq('id', participantId);
        
        if (error) {
          console.error('Error submitting contest:', error);
          toast.error('Failed to submit test');
          setIsSubmitting(false);
          isSubmittingRef.current = false;
          return;
        }
        
        toast.success(`Test submitted successfully! Score: ${score}`);
      }
    } catch (error) {
      console.error('Error submitting contest:', error);
      toast.error('Failed to submit test');
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      return;
    }
    
    setTimeout(() => {
      navigate(`/contests/results/${contest?.contest_code || contestId}`);
    }, 2000);
  }, [participantId, answers, questions, contest, timeLeft, contestId, navigate]);

  const handleQuestionSelect = useCallback((index: number) => {
    setCurrentIndex(index);
    setShowMobileSidebar(false);
  }, []);

  const getDifficultyColor = useCallback((difficulty?: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'hard': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }, []);

  // Loading state
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

  // Contest not found
  if (!isContestValid || !contest) {
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
              <p className="text-gray-600">The requested contest could not be loaded or has expired.</p>
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

  // Test blocked due to cheating
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

  // Participation check failed
  if (!participationChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
        <Card className="max-w-md w-full mx-4 shadow-lg">
          <CardContent className="p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-3 bg-yellow-50 rounded-full">
                <AlertTriangle className="h-12 w-12 text-yellow-500" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">Registration Issue</h2>
              <p className="text-gray-600">There was a problem registering you for the contest.</p>
              <p className="text-sm text-gray-500">Please try again or contact support.</p>
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

  // Main render
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
                disabled={isSubmitting}
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
                  <span>{contest.subjects?.join(', ')}</span>
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
                disabled={isSubmitting}
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
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
                          disabled={isSubmitting}
                          className={`
                            relative h-10 rounded-lg flex items-center justify-center font-medium text-sm transition-all
                            ${isCurrent 
                              ? 'bg-blue-600 text-white ring-2 ring-blue-500 ring-offset-1' 
                              : isAnswered
                              ? 'bg-blue-100 text-blue-700 border border-blue-300'
                              : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed
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
                      <span className="font-semibold text-blue-600">#{stats.userRank || '--'}</span>
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
                      Question {currentQuestion?.question_order || 0} of {totalQuestions}
                      <span className="mx-2">•</span>
                      <span className="font-semibold text-gray-900">{currentQuestion?.marks || 4} Points</span>
                    </div>
                  </div>
                  <div className="text-lg font-bold text-gray-900">
                    #{currentQuestion?.question_order || 0}
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
                  {currentQuestion && Object.entries(currentQuestion.options || {}).map(([key, value], index) => {
                    const isSelected = userAnswer?.selected_answer === key;
                    
                    return (
                      <button
                        key={key}
                        onClick={() => handleAnswer(currentQuestion.id, key)}
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
                            {key}
                          </div>
                          <span className="flex-1 text-gray-900">{value as string}</span>
                          {isSelected && (
                            <CheckCircle className="w-6 h-6 text-blue-500 flex-shrink-0" />
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
                {isSubmitting ? (
                  <span className="flex items-center">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Submitting...
                  </span>
                ) : 'Final Submit'}
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
              disabled={isSubmitting}
            >
              <BarChart className="h-4 w-4" />
              <span className="font-medium">{answeredCount}/{totalQuestions}</span>
            </Button>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0 || isSubmitting}
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
                disabled={currentIndex === totalQuestions - 1 || isSubmitting}
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
                  disabled={isSubmitting}
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
                            disabled={isSubmitting}
                            className={`
                              h-10 rounded-lg flex items-center justify-center font-medium text-sm
                              ${isCurrent 
                                ? 'bg-blue-600 text-white' 
                                : isAnswered
                                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                : 'bg-gray-100 text-gray-700 border border-gray-200'
                              }
                              disabled:opacity-50 disabled:cursor-not-allowed
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
                  {isSubmitting ? (
                    <span className="flex items-center">
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Submitting...
                    </span>
                ) : 'Submit Test'}
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