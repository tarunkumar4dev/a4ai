// src/lib/api/pyq.ts
import { supabase } from '@/lib/supabaseClient';

export interface PYQQuestion {
  id: string;
  class_level: 10 | 12;
  subject: string;
  chapter: string;
  sub_topic?: string;
  question_type: 'PYQ' | 'HOTS' | 'MOST_POPULAR' | 'MOST_REPEATED';
  year?: number;
  board?: string;
  question_text: string;
  options?: string[];
  correct_answer: string;
  explanation?: string;
  difficulty_level: 'Easy' | 'Medium' | 'Hard';
  marks: number;
  created_at?: string;
}

export interface UserProgress {
  question_id: string;
  is_correct: boolean;
  time_taken: number;
  coins_earned: number;
  attempted_at: string;
}

export interface ChapterStats {
  chapter: string;
  total_questions: number;
  attempted: number;
  correct: number;
  coins_earned: number;
  completion_percentage: number;
}

// Mock data for when Supabase fails
const MOCK_QUESTIONS: PYQQuestion[] = [
  {
    id: '1',
    class_level: 10,
    subject: 'Mathematics',
    chapter: 'Real Numbers',
    question_type: 'PYQ',
    year: 2023,
    board: 'CBSE',
    question_text: 'Prove that √2 is an irrational number.',
    options: [
      'Assume √2 is rational, then it can be expressed as a/b where a, b are co-prime',
      '√2 is irrational because it cannot be expressed as a fraction',
      'All square roots of prime numbers are irrational',
      '√2 is approximately 1.414'
    ],
    correct_answer: 'Assume √2 is rational, then it can be expressed as a/b where a, b are co-prime',
    explanation: 'Assume √2 = a/b where a and b are co-prime integers. Squaring both sides gives 2 = a²/b² ⇒ a² = 2b². This means a² is divisible by 2, so a is divisible by 2. Let a = 2c. Then 4c² = 2b² ⇒ b² = 2c², so b is also divisible by 2. This contradicts that a and b are co-prime. Therefore, √2 is irrational.',
    difficulty_level: 'Medium',
    marks: 3
  },
  {
    id: '2',
    class_level: 10,
    subject: 'Science',
    chapter: 'Chemical Reactions',
    question_type: 'PYQ',
    year: 2023,
    board: 'CBSE',
    question_text: 'Why is respiration considered an exothermic reaction?',
    options: [
      'It releases energy in the form of heat',
      'It absorbs energy from surroundings',
      'It produces light',
      'It occurs only at high temperatures'
    ],
    correct_answer: 'It releases energy in the form of heat',
    explanation: 'Respiration is exothermic because glucose reacts with oxygen to produce carbon dioxide, water, and releases energy which is used by cells.',
    difficulty_level: 'Easy',
    marks: 2
  },
  {
    id: '3',
    class_level: 12,
    subject: 'Physics',
    chapter: 'Electrostatics',
    question_type: 'HOTS',
    year: 2023,
    board: 'CBSE',
    question_text: 'Two point charges 4Q and Q are separated by distance r. Where should a third charge be placed for equilibrium?',
    options: [
      'At distance r/3 from Q',
      'At distance r/3 from 4Q',
      'At distance r/2 from Q',
      'At the midpoint'
    ],
    correct_answer: 'At distance r/3 from 4Q',
    explanation: 'Let the third charge q be placed at distance x from 4Q. For equilibrium: k(4Q)q/x² = kQq/(r-x)² ⇒ 4/x² = 1/(r-x)² ⇒ 2/x = 1/(r-x) ⇒ 2r - 2x = x ⇒ x = 2r/3 from Q or r/3 from 4Q.',
    difficulty_level: 'Hard',
    marks: 5
  }
];

// Mock user progress in localStorage
const USER_PROGRESS_KEY = 'pyq_user_progress';
const USER_COINS_KEY = 'pyq_user_coins';

const getMockUserProgress = (userId: string): UserProgress[] => {
  try {
    const stored = localStorage.getItem(`${USER_PROGRESS_KEY}_${userId}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveMockUserProgress = (userId: string, progress: UserProgress[]) => {
  try {
    localStorage.setItem(`${USER_PROGRESS_KEY}_${userId}`, JSON.stringify(progress));
  } catch (error) {
    console.error('Failed to save user progress:', error);
  }
};

const getMockUserCoins = (userId: string): number => {
  try {
    const stored = localStorage.getItem(`${USER_COINS_KEY}_${userId}`);
    return stored ? parseInt(stored) : 0;
  } catch {
    return 0;
  }
};

const saveMockUserCoins = (userId: string, coins: number) => {
  try {
    localStorage.setItem(`${USER_COINS_KEY}_${userId}`, coins.toString());
  } catch (error) {
    console.error('Failed to save user coins:', error);
  }
};

class PYQAPI {
  // Get subjects by class
  async getSubjects(classLevel: 10 | 12): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('pyq_questions')
        .select('subject')
        .eq('class_level', classLevel);
      
      if (error) throw error;
      
      // Fallback to mock data
      if (!data || data.length === 0) {
        const mockSubjects = [...new Set(MOCK_QUESTIONS
          .filter(q => q.class_level === classLevel)
          .map(q => q.subject)
        )];
        return mockSubjects.sort();
      }
      
      return [...new Set(data.map(item => item.subject))].sort();
    } catch (error) {
      console.error('Error fetching subjects, using mock data:', error);
      const mockSubjects = [...new Set(MOCK_QUESTIONS
        .filter(q => q.class_level === classLevel)
        .map(q => q.subject)
      )];
      return mockSubjects.sort();
    }
  }

  // Get chapters by class and subject
  async getChapters(classLevel: 10 | 12, subject: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('pyq_questions')
        .select('chapter')
        .eq('class_level', classLevel)
        .eq('subject', subject);
      
      if (error) throw error;
      
      // Fallback to mock data
      if (!data || data.length === 0) {
        const mockChapters = [...new Set(MOCK_QUESTIONS
          .filter(q => q.class_level === classLevel && q.subject === subject)
          .map(q => q.chapter)
        )];
        return mockChapters.sort();
      }
      
      return [...new Set(data.map(item => item.chapter))].sort();
    } catch (error) {
      console.error('Error fetching chapters, using mock data:', error);
      const mockChapters = [...new Set(MOCK_QUESTIONS
        .filter(q => q.class_level === classLevel && q.subject === subject)
        .map(q => q.chapter)
      )];
      return mockChapters.sort();
    }
  }

  // Get questions by chapter
  async getQuestions(
    classLevel: 10 | 12, 
    subject: string, 
    chapter: string,
    questionType?: string,
    limit: number = 10
  ): Promise<PYQQuestion[]> {
    try {
      let query = supabase
        .from('pyq_questions')
        .select('*')
        .eq('class_level', classLevel)
        .eq('subject', subject)
        .eq('chapter', chapter)
        .limit(limit);
      
      if (questionType) {
        query = query.eq('question_type', questionType);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Fallback to mock data
      if (!data || data.length === 0) {
        let mockQuestions = MOCK_QUESTIONS.filter(q => 
          q.class_level === classLevel && 
          q.subject === subject && 
          q.chapter === chapter
        );
        
        if (questionType) {
          mockQuestions = mockQuestions.filter(q => q.question_type === questionType);
        }
        
        return mockQuestions.slice(0, limit);
      }
      
      // Convert options JSON to array if it exists
      return data.map(q => ({
        ...q,
        options: q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : undefined
      })) as PYQQuestion[];
    } catch (error) {
      console.error('Error fetching questions, using mock data:', error);
      
      let mockQuestions = MOCK_QUESTIONS.filter(q => 
        q.class_level === classLevel && 
        q.subject === subject && 
        q.chapter === chapter
      );
      
      if (questionType) {
        mockQuestions = mockQuestions.filter(q => q.question_type === questionType);
      }
      
      return mockQuestions.slice(0, limit);
    }
  }

  // Get user progress for a chapter
  async getUserProgress(
    userId: string,
    classLevel: 10 | 12,
    subject: string,
    chapter: string
  ): Promise<ChapterStats> {
    try {
      // Try to get total questions from Supabase
      const { data: questions, error: qError } = await supabase
        .from('pyq_questions')
        .select('id')
        .eq('class_level', classLevel)
        .eq('subject', subject)
        .eq('chapter', chapter);
      
      let totalQuestions = 0;
      if (qError || !questions) {
        // Fallback to mock data
        totalQuestions = MOCK_QUESTIONS.filter(q => 
          q.class_level === classLevel && 
          q.subject === subject && 
          q.chapter === chapter
        ).length;
      } else {
        totalQuestions = questions.length;
      }

      // Try to get user progress from Supabase
      try {
        const { data: progress, error: pError } = await supabase
          .from('user_pyq_progress')
          .select('*')
          .eq('user_id', userId)
          .eq('class_level', classLevel)
          .eq('subject', subject)
          .eq('chapter', chapter);
        
        if (pError) throw pError;

        const attempted = progress?.length || 0;
        const correct = progress?.filter(p => p.is_correct).length || 0;
        const coinsEarned = progress?.reduce((sum, p) => sum + (p.coins_earned || 0), 0) || 0;
        
        return {
          chapter,
          total_questions: totalQuestions,
          attempted,
          correct,
          coins_earned: coinsEarned,
          completion_percentage: totalQuestions > 0 ? (attempted / totalQuestions) * 100 : 0
        };
      } catch (progressError) {
        // Fallback to localStorage mock data
        const userProgressData = getMockUserProgress(userId);
        const chapterProgress = userProgressData.filter(p => {
          const question = MOCK_QUESTIONS.find(q => q.id === p.question_id);
          return question && 
                question.class_level === classLevel && 
                question.subject === subject && 
                question.chapter === chapter;
        });
        
        const attempted = chapterProgress.length;
        const correct = chapterProgress.filter(p => p.is_correct).length;
        const coinsEarned = chapterProgress.reduce((sum, p) => sum + p.coins_earned, 0);
        
        return {
          chapter,
          total_questions: totalQuestions,
          attempted,
          correct,
          coins_earned: coinsEarned,
          completion_percentage: totalQuestions > 0 ? (attempted / totalQuestions) * 100 : 0
        };
      }
    } catch (error) {
      console.error('Error getting user progress:', error);
      // Return empty stats
      return {
        chapter,
        total_questions: 0,
        attempted: 0,
        correct: 0,
        coins_earned: 0,
        completion_percentage: 0
      };
    }
  }

  // Submit answer and update progress
  async submitAnswer(
    userId: string,
    questionId: string,
    answer: string,
    timeTaken: number
  ): Promise<{ isCorrect: boolean; coinsEarned: number; explanation: string }> {
    try {
      // Try to get question from Supabase
      const { data: question, error: qError } = await supabase
        .from('pyq_questions')
        .select('*')
        .eq('id', questionId)
        .single();
      
      if (qError) {
        // Fallback to mock data
        const mockQuestion = MOCK_QUESTIONS.find(q => q.id === questionId);
        if (!mockQuestion) {
          throw new Error('Question not found');
        }
        return this.handleMockSubmission(userId, mockQuestion, answer, timeTaken);
      }

      // Check if user already attempted this question in Supabase
      try {
        const { data: existing } = await supabase
          .from('user_pyq_progress')
          .select('id')
          .eq('user_id', userId)
          .eq('question_id', questionId)
          .maybeSingle();

        if (existing) {
          throw new Error('You have already attempted this question');
        }
      } catch (checkError) {
        // If table doesn't exist, check localStorage
        const mockProgress = getMockUserProgress(userId);
        if (mockProgress.some(p => p.question_id === questionId)) {
          throw new Error('You have already attempted this question');
        }
      }

      const isCorrect = answer === question.correct_answer;
      let coinsEarned = 0;

      if (isCorrect) {
        // Base coins based on difficulty
        const baseCoins = {
          'Easy': 1,
          'Medium': 2,
          'Hard': 3
        }[question.difficulty_level] || 1;

        // Bonus for quick answers (under 30 seconds)
        const timeBonus = timeTaken < 30 ? 1 : 0;
        
        coinsEarned = baseCoins + timeBonus;

        // Try to update user's coins in Supabase
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('coins')
            .eq('id', userId)
            .single();

          if (profile) {
            await supabase
              .from('profiles')
              .update({ coins: (profile.coins || 0) + coinsEarned })
              .eq('id', userId);
          }
        } catch (coinError) {
          // Fallback to localStorage
          const currentCoins = getMockUserCoins(userId);
          saveMockUserCoins(userId, currentCoins + coinsEarned);
        }
      }

      // Try to save user progress in Supabase
      try {
        await supabase
          .from('user_pyq_progress')
          .insert({
            user_id: userId,
            question_id: questionId,
            class_level: question.class_level,
            subject: question.subject,
            chapter: question.chapter,
            is_correct: isCorrect,
            time_taken: timeTaken,
            coins_earned: coinsEarned,
            attempted_at: new Date().toISOString()
          });
      } catch (progressError) {
        // Fallback to localStorage
        const userProgressData = getMockUserProgress(userId);
        userProgressData.push({
          question_id: questionId,
          is_correct: isCorrect,
          time_taken: timeTaken,
          coins_earned: coinsEarned,
          attempted_at: new Date().toISOString()
        });
        saveMockUserProgress(userId, userProgressData);
      }

      return {
        isCorrect,
        coinsEarned,
        explanation: question.explanation || ''
      };
    } catch (error: any) {
      console.error('Error submitting answer:', error);
      throw error;
    }
  }

  // Handle mock submission when Supabase fails
  private handleMockSubmission(
    userId: string,
    question: PYQQuestion,
    answer: string,
    timeTaken: number
  ): { isCorrect: boolean; coinsEarned: number; explanation: string } {
    const isCorrect = answer === question.correct_answer;
    let coinsEarned = 0;

    if (isCorrect) {
      const baseCoins = {
        'Easy': 1,
        'Medium': 2,
        'Hard': 3
      }[question.difficulty_level] || 1;

      const timeBonus = timeTaken < 30 ? 1 : 0;
      coinsEarned = baseCoins + timeBonus;

      // Save coins to localStorage
      const currentCoins = getMockUserCoins(userId);
      saveMockUserCoins(userId, currentCoins + coinsEarned);
    }

    // Save progress to localStorage
    const userProgressData = getMockUserProgress(userId);
    userProgressData.push({
      question_id: question.id,
      is_correct: isCorrect,
      time_taken: timeTaken,
      coins_earned: coinsEarned,
      attempted_at: new Date().toISOString()
    });
    saveMockUserProgress(userId, userProgressData);

    return {
      isCorrect,
      coinsEarned,
      explanation: question.explanation || ''
    };
  }

  // Get leaderboard for a chapter/subject
  async getLeaderboard(
    classLevel: 10 | 12,
    subject: string,
    chapter?: string
  ): Promise<Array<{ user_id: string; full_name: string; score: number; coins: number }>> {
    try {
      // Try to get leaderboard from Supabase
      const { data, error } = await supabase.rpc('get_pyq_leaderboard', {
        p_class_level: classLevel,
        p_subject: subject,
        p_chapter: chapter
      });
      
      if (!error && data) {
        return data;
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
    
    // Fallback to mock leaderboard
    return [
      { user_id: '1', full_name: 'Student 1', score: 85, coins: 150 },
      { user_id: '2', full_name: 'Student 2', score: 78, coins: 120 },
      { user_id: '3', full_name: 'Student 3', score: 92, coins: 180 },
      { user_id: '4', full_name: 'Student 4', score: 65, coins: 95 },
      { user_id: '5', full_name: 'Student 5', score: 88, coins: 135 },
    ];
  }
}

export const pyqAPI = new PYQAPI();