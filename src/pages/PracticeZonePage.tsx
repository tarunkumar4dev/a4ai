// src/pages/PracticeZonePage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { BookOpen, GraduationCap, Trophy, Target, TrendingUp, ChevronRight, Sparkles, Coins } from 'lucide-react';

// Mock data for subjects and chapters
const MOCK_DATA = {
  10: {
    subjects: ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi', 'Sanskrit'],
    chapters: {
      'Mathematics': ['Real Numbers', 'Polynomials', 'Pair of Linear Equations', 'Quadratic Equations', 'Arithmetic Progressions'],
      'Science': ['Chemical Reactions', 'Acids, Bases and Salts', 'Metals and Non-metals', 'Life Processes', 'Light'],
      'Social Science': ['Nationalism in India', 'The Making of a Global World', 'Print Culture', 'Minerals and Energy Resources'],
      'English': ['Reading Comprehension', 'Writing Skills', 'Grammar', 'Literature'],
      'Hindi': ['पद्य', 'गद्य', 'व्याकरण', 'लेखन'],
      'Sanskrit': ['अपठित-अवबोधनम्', 'रचनात्मक-कार्यम्', 'पठित-अवबोधनम्']
    },
    sampleQuestions: {
      'Mathematics': {
        'Real Numbers': [
          { type: 'PYQ', question: 'Prove that √3 is an irrational number. (2019)' },
          { type: 'HOTS', question: 'Find the smallest number that when divided by 28 and 32 leaves remainders 8 and 12 respectively.' },
          { type: 'MOST_REPEATED', question: 'Use Euclid\'s division algorithm to find the HCF of 135 and 225. (2018, 2020)' }
        ],
        'Polynomials': [
          { type: 'PYQ', question: 'Find the zeroes of the polynomial x² - 3 and verify the relationship between zeroes and coefficients. (2020)' },
          { type: 'HOTS', question: 'If α and β are zeroes of polynomial x² - 6x + k, find k if 3α + 2β = 20.' }
        ]
      },
      'Science': {
        'Chemical Reactions': [
          { type: 'PYQ', question: 'Why is respiration considered an exothermic reaction? Explain. (2019)' },
          { type: 'MOST_REPEATED', question: 'What is rancidity? Write two methods to prevent it. (2017, 2019, 2022)' }
        ]
      }
    }
  },
  12: {
    subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science', 'English'],
    chapters: {
      'Physics': ['Electrostatics', 'Current Electricity', 'Magnetic Effects', 'Optics', 'Modern Physics'],
      'Chemistry': ['Solutions', 'Electrochemistry', 'Chemical Kinetics', 'd-block Elements', 'Biomolecules'],
      'Mathematics': ['Relations and Functions', 'Matrices', 'Calculus', 'Probability', '3D Geometry'],
      'Biology': ['Reproduction', 'Genetics', 'Biotechnology', 'Ecology'],
      'Computer Science': ['Python Programming', 'Database Management', 'Computer Networks', 'Boolean Algebra'],
      'English': ['Reading Comprehension', 'Advanced Writing', 'Flamingo', 'Vistas']
    },
    sampleQuestions: {
      'Physics': {
        'Electrostatics': [
          { type: 'PYQ', question: 'Derive an expression for electric field due to an electric dipole at a point on its equatorial plane. (2023)' },
          { type: 'HOTS', question: 'Two point charges 4Q and Q are separated by distance r. Where should a third charge be placed for equilibrium?' }
        ]
      },
      'Chemistry': {
        'Electrochemistry': [
          { type: 'MOST_REPEATED', question: 'State Kohlrausch\'s law. How is molar conductivity related to concentration? (2019, 2021, 2023)' }
        ]
      }
    }
  }
};

export default function PracticeZonePage() {
  const navigate = useNavigate();
  const [classLevel, setClassLevel] = useState<10 | 12>(10);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [chapters, setChapters] = useState<string[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [progress, setProgress] = useState({
    completion_percentage: 0,
    correct: 0,
    coins_earned: 0
  });

  // Load subjects when class level changes
  useEffect(() => {
    const classData = MOCK_DATA[classLevel];
    setSubjects(classData.subjects);
    setSelectedSubject(classData.subjects[0]);
  }, [classLevel]);

  // Load chapters when subject changes
  useEffect(() => {
    if (selectedSubject) {
      const classData = MOCK_DATA[classLevel];
      const subjectChapters = classData.chapters[selectedSubject] || [];
      setChapters(subjectChapters);
      if (subjectChapters.length > 0) {
        setSelectedChapter(subjectChapters[0]);
      }
    }
  }, [selectedSubject, classLevel]);

  // Load questions when chapter changes
  useEffect(() => {
    if (selectedSubject && selectedChapter) {
      const classData = MOCK_DATA[classLevel];
      const subjectQuestions = classData.sampleQuestions[selectedSubject]?.[selectedChapter] || [];
      setQuestions(subjectQuestions);
      
      // Mock progress data
      setProgress({
        completion_percentage: Math.floor(Math.random() * 100),
        correct: Math.floor(Math.random() * 50),
        coins_earned: Math.floor(Math.random() * 500)
      });
    }
  }, [selectedSubject, selectedChapter, classLevel]);

  const handleStartPractice = (questionType?: string) => {
    navigate(`/practice/session?class=${classLevel}&subject=${encodeURIComponent(selectedSubject)}&chapter=${encodeURIComponent(selectedChapter)}&type=${questionType || 'all'}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            <BookOpen className="inline mr-3 h-9 w-9 text-blue-600" />
            Practice Zone
          </h1>
          <p className="text-lg text-gray-600">
            Master concepts with Previous Year Questions (PYQs)
          </p>
        </div>

        {/* Class Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Select Class
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                variant={classLevel === 10 ? "default" : "outline"}
                className={`flex-1 text-lg ${classLevel === 10 ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                onClick={() => setClassLevel(10)}
              >
                Class 10
              </Button>
              <Button
                variant={classLevel === 12 ? "default" : "outline"}
                className={`flex-1 text-lg ${classLevel === 12 ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                onClick={() => setClassLevel(12)}
              >
                Class 12
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Subject & Chapter Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Subject Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Select Subject
                </CardTitle>
                <CardDescription>
                  Choose a subject to practice
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {subjects.map(subject => (
                    <Button
                      key={subject}
                      variant={selectedSubject === subject ? "default" : "outline"}
                      className={`h-auto py-4 ${selectedSubject === subject ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                      onClick={() => setSelectedSubject(subject)}
                    >
                      <span className="text-sm font-medium">{subject}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Chapter Selection */}
            {selectedSubject && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Select Chapter
                  </CardTitle>
                  <CardDescription>
                    Choose a chapter to practice
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {chapters.map(chapter => (
                      <Button
                        key={chapter}
                        variant={selectedChapter === chapter ? "default" : "outline"}
                        className={`w-full justify-start h-auto py-3 ${selectedChapter === chapter ? 'bg-green-600 hover:bg-green-700' : ''}`}
                        onClick={() => setSelectedChapter(chapter)}
                      >
                        <span className="text-left">{chapter}</span>
                        {selectedChapter === chapter && (
                          <ChevronRight className="ml-auto h-4 w-4" />
                        )}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sample Questions Preview */}
            {questions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Sample Questions ({selectedChapter})</CardTitle>
                  <CardDescription>
                    Preview of available questions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {questions.slice(0, 3).map((q, index) => (
                      <div key={index} className="p-4 border rounded-lg bg-gray-50">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            q.type === 'PYQ' ? 'bg-blue-100 text-blue-800' :
                            q.type === 'HOTS' ? 'bg-red-100 text-red-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {q.type}
                          </span>
                        </div>
                        <p className="text-gray-800">{q.question}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Practice Options & Stats */}
          <div className="space-y-6">
            {/* Chapter Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Chapter Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Completion</span>
                    <span className="font-semibold">{progress.completion_percentage}%</span>
                  </div>
                  <Progress value={progress.completion_percentage} className="h-2" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {progress.correct}
                    </div>
                    <div className="text-sm text-gray-600">Correct Answers</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {progress.coins_earned}
                    </div>
                    <div className="text-sm text-gray-600">Coins Earned</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Practice Modes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Practice Modes
                </CardTitle>
                <CardDescription>
                  Choose how you want to practice
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full justify-start h-auto py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                  onClick={() => handleStartPractice()}
                  disabled={!selectedChapter}
                >
                  <Sparkles className="mr-3 h-5 w-5" />
                  <div className="text-left">
                    <div className="font-semibold">Start Practice</div>
                    <div className="text-sm opacity-90">All question types</div>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4" />
                </Button>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-auto py-3 border-blue-200 hover:bg-blue-50"
                    onClick={() => handleStartPractice('PYQ')}
                    disabled={!selectedChapter}
                  >
                    <div className="text-left">
                      <div className="font-semibold">PYQs Only</div>
                      <div className="text-xs text-gray-600">Previous Year</div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-auto py-3 border-red-200 hover:bg-red-50"
                    onClick={() => handleStartPractice('HOTS')}
                    disabled={!selectedChapter}
                  >
                    <div className="text-left">
                      <div className="font-semibold">HOTS</div>
                      <div className="text-xs text-gray-600">Higher Order</div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}