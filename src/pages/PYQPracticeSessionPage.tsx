// src/pages/PYQPracticeSessionPage.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Coins, 
  Trophy,
  Sparkles,
  BookOpen,
  SkipForward,
  Award,
  Target
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Mock questions database
const MOCK_QUESTIONS = {
  10: {
    'Mathematics': {
      'Real Numbers': [
        {
          id: 'math-10-1',
          question_text: 'Prove that √3 is an irrational number.',
          question_type: 'PYQ',
          difficulty_level: 'Medium',
          year: 2019,
          marks: 3,
          options: [
            'Assume √3 is rational, then it can be expressed as a/b where a, b are co-prime',
            '√3 is irrational because it cannot be expressed as a fraction',
            'All square roots of prime numbers are irrational',
            '√3 is approximately 1.732'
          ],
          correct_answer: 'Assume √3 is rational, then it can be expressed as a/b where a, b are co-prime',
          explanation: 'Assume √3 = a/b where a and b are co-prime integers. Squaring both sides gives 3 = a²/b² ⇒ a² = 3b². This means a² is divisible by 3, so a is divisible by 3. Let a = 3c. Then 9c² = 3b² ⇒ b² = 3c², so b is also divisible by 3. This contradicts that a and b are co-prime. Therefore, √3 is irrational.'
        },
        {
          id: 'math-10-2',
          question_text: 'Use Euclid\'s division algorithm to find the HCF of 135 and 225.',
          question_type: 'MOST_REPEATED',
          difficulty_level: 'Easy',
          year: 2020,
          marks: 2,
          options: [
            '15',
            '25',
            '35',
            '45'
          ],
          correct_answer: '45',
          explanation: '225 = 135 × 1 + 90, 135 = 90 × 1 + 45, 90 = 45 × 2 + 0. Therefore, HCF = 45.'
        },
        {
          id: 'math-10-3',
          question_text: 'Find the LCM of 24 and 90 by prime factorization method.',
          question_type: 'PYQ',
          difficulty_level: 'Easy',
          year: 2021,
          marks: 2,
          options: [
            '240',
            '360',
            '480',
            '720'
          ],
          correct_answer: '360',
          explanation: '24 = 2³ × 3, 90 = 2 × 3² × 5. LCM = 2³ × 3² × 5 = 8 × 9 × 5 = 360.'
        }
      ],
      'Polynomials': [
        {
          id: 'math-10-4',
          question_text: 'Find the zeroes of the polynomial x² - 3x + 2.',
          question_type: 'HOTS',
          difficulty_level: 'Medium',
          marks: 3,
          options: [
            '1, 2',
            '2, 3',
            '1, 3',
            '-1, -2'
          ],
          correct_answer: '1, 2',
          explanation: 'x² - 3x + 2 = (x-1)(x-2). Zeroes are x = 1 and x = 2.'
        }
      ]
    },
    'Science': {
      'Chemical Reactions': [
        {
          id: 'sci-10-1',
          question_text: 'Why is respiration considered an exothermic reaction?',
          question_type: 'PYQ',
          difficulty_level: 'Medium',
          year: 2019,
          marks: 2,
          options: [
            'It releases energy in the form of heat',
            'It absorbs energy from surroundings',
            'It produces light',
            'It occurs only at high temperatures'
          ],
          correct_answer: 'It releases energy in the form of heat',
          explanation: 'Respiration is exothermic because glucose reacts with oxygen to produce carbon dioxide, water, and releases energy which is used by cells.'
        }
      ]
    }
  },
  12: {
    'Physics': {
      'Electrostatics': [
        {
          id: 'phy-12-1',
          question_text: 'Two point charges 4Q and Q are separated by distance r. Where should a third charge be placed for equilibrium?',
          question_type: 'HOTS',
          difficulty_level: 'Hard',
          marks: 5,
          options: [
            'At distance r/3 from Q',
            'At distance r/3 from 4Q',
            'At distance r/2 from Q',
            'At the midpoint'
          ],
          correct_answer: 'At distance r/3 from 4Q',
          explanation: 'Let the third charge q be placed at distance x from 4Q. For equilibrium: k(4Q)q/x² = kQq/(r-x)² ⇒ 4/x² = 1/(r-x)² ⇒ 2/x = 1/(r-x) ⇒ 2r - 2x = x ⇒ x = 2r/3 from Q or r/3 from 4Q.'
        }
      ]
    },
    'Chemistry': {
      'Electrochemistry': [
        {
          id: 'chem-12-1',
          question_text: 'State Kohlrausch\'s law of independent migration of ions.',
          question_type: 'MOST_REPEATED',
          difficulty_level: 'Medium',
          year: 2023,
          marks: 3,
          options: [
            'Λₘ° = λ₊° + λ₋°',
            'Λₘ = κ/c',
            'E° cell = E° cathode - E° anode',
            'G = -nFE'
          ],
          correct_answer: 'Λₘ° = λ₊° + λ₋°',
          explanation: 'Kohlrausch\'s law states that the limiting molar conductivity of an electrolyte can be expressed as the sum of the limiting molar conductivities of its individual ions.'
        }
      ]
    }
  }
};

// Mock API functions
const mockAPI = {
  getQuestions: async (classLevel: number, subject: string, chapter: string, limit = 5) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const questions = MOCK_QUESTIONS[classLevel]?.[subject]?.[chapter] || [];
    
    // Return limited number of questions
    return questions.slice(0, limit).map((q, index) => ({
      ...q,
      question_number: index + 1
    }));
  },

  submitAnswer: async (questionId: string, selectedAnswer: string, timeTaken: number) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Find the question
    let correctAnswer = '';
    let explanation = '';
    
    // Search through all questions to find the correct one
    Object.entries(MOCK_QUESTIONS).forEach(([classLevel, subjects]) => {
      Object.entries(subjects).forEach(([subject, chapters]) => {
        Object.entries(chapters).forEach(([chapter, questions]) => {
          questions.forEach(q => {
            if (q.id === questionId) {
              correctAnswer = q.correct_answer;
              explanation = q.explanation;
            }
          });
        });
      });
    });
    
    const isCorrect = selectedAnswer === correctAnswer;
    
    // Calculate coins earned
    let coinsEarned = 0;
    if (isCorrect) {
      if (timeTaken < 30) {
        coinsEarned = 10; // Fast correct answer
      } else if (timeTaken < 60) {
        coinsEarned = 7; // Medium speed
      } else {
        coinsEarned = 5; // Slow but correct
      }
    }
    
    return {
      isCorrect,
      coinsEarned,
      explanation,
      correctAnswer: correctAnswer
    };
  }
};

export default function PYQPracticeSessionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState(0);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());
  const [totalCoins, setTotalCoins] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  
  const timerRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef<number>(Date.now());

  const classLevel = parseInt(searchParams.get('class') || '10') as 10 | 12;
  const subject = searchParams.get('subject') || 'Mathematics';
  const chapter = searchParams.get('chapter') || 'Real Numbers';
  const questionType = searchParams.get('type') || 'all';

  useEffect(() => {
    loadQuestions();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (questions.length > 0 && !showResult) {
      startTimer();
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentQuestionIndex, showResult]);

  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    startTimeRef.current = Date.now();
    setTimer(0);
    
    timerRef.current = setInterval(() => {
      setTimer(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const data = await mockAPI.getQuestions(classLevel, subject, chapter, 5);
      setQuestions(data);
      if (data.length === 0) {
        toast({
          title: 'No Questions Found',
          description: `No questions available for ${chapter} chapter in ${subject}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading questions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load questions. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || showResult) return;

    const currentQuestion = questions[currentQuestionIndex];
    
    // Prevent answering the same question twice
    if (answeredQuestions.has(currentQuestion.id)) {
      toast({
        title: 'Already Answered',
        description: 'You have already answered this question.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await mockAPI.submitAnswer(
        currentQuestion.id,
        selectedAnswer,
        timer
      );

      setIsCorrect(result.isCorrect);
      setCoinsEarned(result.coinsEarned);
      setExplanation(result.explanation);
      setShowResult(true);
      
      // Update totals
      if (result.isCorrect) {
        setTotalCorrect(prev => prev + 1);
        setTotalCoins(prev => prev + result.coinsEarned);
      }
      
      // Add to answered questions
      setAnsweredQuestions(prev => new Set([...prev, currentQuestion.id]));

      // Show toast
      if (result.isCorrect) {
        toast({
          title: 'Correct Answer! 🎉',
          description: `You earned ${result.coinsEarned} coins!`,
          className: 'bg-green-100 border-green-400 text-green-800',
        });
      } else {
        toast({
          title: 'Incorrect Answer',
          description: `The correct answer is: ${result.correctAnswer}`,
          variant: 'destructive',
        });
      }

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit answer',
        variant: 'destructive',
      });
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer('');
      setShowResult(false);
      setIsCorrect(false);
      setCoinsEarned(0);
      setExplanation('');
    } else {
      handleSessionComplete();
    }
  };

  const handleSkipQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer('');
      setShowResult(false);
      setIsCorrect(false);
      setCoinsEarned(0);
      setExplanation('');
      
      toast({
        title: 'Question Skipped',
        description: 'Moving to next question...',
      });
    } else {
      handleSessionComplete();
    }
  };

  const handleSessionComplete = () => {
    toast({
      title: 'Session Complete! 🎊',
      description: `You answered ${totalCorrect}/${questions.length} questions correctly and earned ${totalCoins} coins!`,
      className: 'bg-blue-100 border-blue-400 text-blue-800',
      duration: 5000,
    });

    // Navigate back to practice zone after delay
    setTimeout(() => {
      navigate('/practice/zone');
    }, 3000);
  };

  const currentQuestion = questions[currentQuestionIndex];
  const progressPercentage = questions.length > 0 
    ? ((currentQuestionIndex + 1) / questions.length) * 100 
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading questions...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              No Questions Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-center mb-4">
              No questions found for {subject} - {chapter} (Class {classLevel})
            </p>
            <p className="text-sm text-gray-500 text-center">
              Try selecting a different chapter or subject.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={() => navigate('/practice/zone')} 
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Practice Zone
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/practice/zone')}
            className="hover:bg-blue-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Practice Zone
          </Button>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full shadow border">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="font-mono font-bold">{timer}s</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full shadow border">
              <Coins className="h-4 w-4 text-yellow-500" />
              <span className="font-semibold">{totalCoins}</span>
              <span className="text-sm text-gray-500">coins</span>
            </div>
          </div>
        </div>

        {/* Session Info */}
        <Card className="mb-6 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  {subject} - {chapter}
                </h2>
                <p className="text-gray-600">Class {classLevel}</p>
              </div>
              <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                <Target className="mr-1 h-3 w-3" />
                Practice Session
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Question {currentQuestionIndex + 1} of {questions.length}</span>
            <span className="font-bold">{Math.round(progressPercentage)}% Complete</span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
        </div>

        {/* Question Card */}
        <Card className="mb-6 shadow-lg border-blue-100">
          <CardHeader className="bg-blue-50 rounded-t-lg">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant="outline" className="bg-white text-blue-700 border-blue-300">
                    {currentQuestion.question_type}
                  </Badge>
                  {currentQuestion.year && (
                    <Badge variant="outline" className="bg-white text-green-700 border-green-300">
                      Year: {currentQuestion.year}
                    </Badge>
                  )}
                  <Badge variant="outline" className="bg-white text-purple-700 border-purple-300">
                    {currentQuestion.difficulty_level}
                  </Badge>
                  <Badge variant="outline" className="bg-white text-orange-700 border-orange-300">
                    Marks: {currentQuestion.marks}
                  </Badge>
                </div>
                <CardTitle className="text-xl text-gray-800">
                  Q{currentQuestion.question_number}. {currentQuestion.question_text}
                </CardTitle>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {/* Options for MCQ */}
            {currentQuestion.options && currentQuestion.options.length > 0 ? (
              <RadioGroup
                value={selectedAnswer}
                onValueChange={setSelectedAnswer}
                className="space-y-3"
              >
                {currentQuestion.options.map((option: string, index: number) => (
                  <div
                    key={index}
                    className={`flex items-center space-x-3 p-4 rounded-lg border transition-all ${
                      showResult
                        ? option === currentQuestion.correct_answer
                          ? 'bg-green-50 border-green-400'
                          : selectedAnswer === option && !isCorrect
                          ? 'bg-red-50 border-red-400'
                          : 'border-gray-200'
                        : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                    }`}
                    onClick={() => !showResult && setSelectedAnswer(option)}
                  >
                    <RadioGroupItem
                      value={option}
                      id={`option-${index}`}
                      disabled={showResult}
                      className="h-5 w-5"
                    />
                    <Label
                      htmlFor={`option-${index}`}
                      className={`flex-1 cursor-pointer text-lg ${
                        showResult && option === currentQuestion.correct_answer
                          ? 'text-green-800 font-bold'
                          : showResult && selectedAnswer === option && !isCorrect
                          ? 'text-red-800 font-bold'
                          : 'text-gray-800'
                      }`}
                    >
                      {String.fromCharCode(65 + index)}. {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              // For subjective questions
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  This is a subjective question. Type your answer below:
                </div>
                <textarea
                  value={selectedAnswer}
                  onChange={(e) => setSelectedAnswer(e.target.value)}
                  placeholder="Type your detailed answer here..."
                  className="w-full h-40 p-4 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  disabled={showResult}
                />
              </div>
            )}

            {/* Result Display */}
            {showResult && (
              <div className={`mt-8 p-6 rounded-lg border-2 ${
                isCorrect ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300' : 'bg-gradient-to-r from-red-50 to-pink-50 border-red-300'
              }`}>
                <div className="flex items-start gap-4 mb-4">
                  {isCorrect ? (
                    <>
                      <div className="flex-shrink-0">
                        <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-2xl text-green-800 mb-1">Excellent! Correct Answer! 🎉</h4>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 text-green-700">
                            <Coins className="h-5 w-5" />
                            <span className="font-bold text-lg">+{coinsEarned} coins earned</span>
                          </div>
                          <div className="flex items-center gap-2 text-blue-700">
                            <Award className="h-5 w-5" />
                            <span className="font-semibold">{Math.round(100 - (timer/60)*100)}% accuracy</span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-shrink-0">
                        <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                          <XCircle className="h-8 w-8 text-red-600" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-2xl text-red-800 mb-1">Incorrect Answer</h4>
                        <p className="text-red-700 text-lg font-semibold">
                          Correct answer: {currentQuestion.correct_answer}
                        </p>
                      </div>
                    </>
                  )}
                </div>
                
                {explanation && (
                  <div className="mt-4 pt-4 border-t">
                    <h5 className="font-bold text-gray-700 mb-3 text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      Detailed Explanation:
                    </h5>
                    <p className="text-gray-700 text-lg leading-relaxed">{explanation}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between bg-gray-50 rounded-b-lg">
            <Button
              variant="outline"
              onClick={handleSkipQuestion}
              disabled={showResult}
              className="border-gray-300 hover:bg-gray-100"
            >
              <SkipForward className="mr-2 h-4 w-4" />
              Skip Question
            </Button>
            
            {!showResult ? (
              <Button
                onClick={handleSubmitAnswer}
                disabled={!selectedAnswer}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-lg px-8 py-6"
                size="lg"
              >
                Submit Answer
              </Button>
            ) : (
              <Button
                onClick={handleNextQuestion}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-lg px-8 py-6"
                size="lg"
              >
                {currentQuestionIndex < questions.length - 1 ? (
                  <>
                    Next Question
                    <Sparkles className="ml-2 h-5 w-5" />
                  </>
                ) : (
                  <>
                    Finish Session
                    <Trophy className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Session Stats */}
        <Card className="shadow-md">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Session Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div className="bg-gradient-to-br from-blue-100 to-blue-50 p-4 rounded-xl border border-blue-200">
                <div className="text-3xl font-bold text-blue-700 mb-1">
                  {currentQuestionIndex + 1}
                </div>
                <div className="text-sm text-gray-600 font-medium">Current Question</div>
              </div>
              <div className="bg-gradient-to-br from-green-100 to-green-50 p-4 rounded-xl border border-green-200">
                <div className="text-3xl font-bold text-green-700 mb-1">
                  {answeredQuestions.size}
                </div>
                <div className="text-sm text-gray-600 font-medium">Questions Answered</div>
              </div>
              <div className="bg-gradient-to-br from-yellow-100 to-yellow-50 p-4 rounded-xl border border-yellow-200">
                <div className="text-3xl font-bold text-yellow-700 mb-1">
                  {totalCorrect}
                </div>
                <div className="text-sm text-gray-600 font-medium">Correct Answers</div>
              </div>
              <div className="bg-gradient-to-br from-purple-100 to-purple-50 p-4 rounded-xl border border-purple-200">
                <div className="text-3xl font-bold text-purple-700 mb-1">
                  {questions.length - answeredQuestions.size}
                </div>
                <div className="text-sm text-gray-600 font-medium">Remaining</div>
              </div>
            </div>
            
            {/* Accuracy Progress */}
            <div className="mt-8">
              <div className="flex justify-between mb-2">
                <span className="font-medium text-gray-700">Session Accuracy</span>
                <span className="font-bold text-blue-700">
                  {questions.length > 0 ? Math.round((totalCorrect / questions.length) * 100) : 0}%
                </span>
              </div>
              <Progress 
                value={questions.length > 0 ? (totalCorrect / questions.length) * 100 : 0} 
                className="h-3 bg-gray-200"
              />
            </div>
          </CardContent>
        </Card>

        {/* Bottom Navigation */}
        <div className="mt-6 flex justify-center">
          <div className="flex gap-2">
            {questions.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  if (index !== currentQuestionIndex && answeredQuestions.has(questions[index].id)) {
                    setCurrentQuestionIndex(index);
                    setSelectedAnswer('');
                    setShowResult(true);
                  }
                }}
                className={`h-3 w-8 rounded-full transition-all ${
                  index === currentQuestionIndex
                    ? 'bg-blue-600'
                    : answeredQuestions.has(questions[index].id)
                    ? 'bg-green-500'
                    : 'bg-gray-300'
                }`}
                title={`Question ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}