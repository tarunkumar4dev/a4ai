// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

/** ---------------- Environment Validation ---------------- */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Production environment validation
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  const errorMessage = `
    [A4AI] Critical: Supabase credentials are missing!
    
    Required Environment Variables:
    - VITE_SUPABASE_URL: Your Supabase project URL
    - VITE_SUPABASE_ANON_KEY: Your Supabase anonymous key
    
    Please add these to your .env file:
    
    VITE_SUPABASE_URL=https://your-project.supabase.co
    VITE_SUPABASE_ANON_KEY=your-anon-key-here
    
    Development Note: In production, ensure these are properly configured.
  `;
  
  console.error(errorMessage);
  
  // In development, we can continue but API calls will fail
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Supabase credentials are required in production');
  }
}

/** ---------------- Client Configuration ---------------- */
export const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storage: window.localStorage,
      storageKey: "a4ai-auth-token",
    },
    global: {
      headers: { 
        "x-client-info": "a4ai-web",
        "x-application-name": "A4AI Learning Platform",
        "x-version": "1.0.0"
      },
    },
    db: {
      schema: 'public'
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
);

/** ---------------- Database Health Check ---------------- */
export const checkDatabaseConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('mega_contests')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('[A4AI] Database connection failed:', error);
      return { connected: false, error: error.message };
    }
    
    console.log('[A4AI] Database connection successful');
    return { connected: true };
  } catch (error: any) {
    console.error('[A4AI] Database connection error:', error);
    return { connected: false, error: error.message };
  }
};

/** ---------------- MEGA CONTEST FUNCTIONS ---------------- */
export const megaContestDB = {
  // Get active mega contests
  async getActiveMegaContests(limit = 10) {
    try {
      const { data, error } = await supabase
        .from('mega_contests')
        .select(`
          id,
          title,
          class,
          subjects,
          duration_minutes,
          total_marks,
          total_questions,
          start_time,
          end_time,
          is_active
        `)
        .eq('is_active', true)
        .gte('end_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      console.error('[A4AI] Error fetching mega contests:', error);
      return { data: null, error: error.message };
    }
  },

  // Get contest by ID
  async getContestById(contestId: string) {
    try {
      const { data, error } = await supabase
        .from('mega_contests')
        .select('*')
        .eq('id', contestId)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      console.error(`[A4AI] Error fetching contest ${contestId}:`, error);
      return { data: null, error: error.message };
    }
  },

  // Get contest questions
  async getContestQuestions(contestId: string) {
    try {
      const { data, error } = await supabase
        .from('mega_contest_questions')
        .select(`
          id,
          contest_id,
          question_number,
          question_text,
          options,
          correct_answer,
          marks,
          subject,
          difficulty,
          explanation
        `)
        .eq('contest_id', contestId)
        .order('question_number', { ascending: true });

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      console.error(`[A4AI] Error fetching questions for contest ${contestId}:`, error);
      return { data: null, error: error.message };
    }
  },

  // Save contest submission
  async saveContestSubmission(
    contestId: string,
    userId: string,
    questionId: string,
    selectedOption: number
  ) {
    try {
      const { data, error } = await supabase
        .from('mega_contest_submissions')
        .upsert({
          contest_id: contestId,
          user_id: userId,
          question_id: questionId,
          selected_option: selectedOption,
          submitted_at: new Date().toISOString()
        }, {
          onConflict: 'contest_id,user_id,question_id'
        })
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      console.error('[A4AI] Error saving contest submission:', error);
      return { data: null, error: error.message };
    }
  },

  // Get user's contest submissions
  async getUserSubmissions(contestId: string, userId: string) {
    try {
      const { data, error } = await supabase
        .from('mega_contest_submissions')
        .select('question_id, selected_option, submitted_at')
        .eq('contest_id', contestId)
        .eq('user_id', userId);

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      console.error('[A4AI] Error fetching user submissions:', error);
      return { data: null, error: error.message };
    }
  },

  // Create or update participant
  async upsertParticipant(
    contestId: string,
    userId: string,
    data: {
      contest_code?: string;
      started_at?: string;
      finished_at?: string | null;
      status?: 'not_started' | 'in_progress' | 'completed';
      total_score?: number | null;
      questions_attempted?: number;
      time_taken?: number;
    }
  ) {
    try {
      const participantData = {
        contest_id: contestId,
        user_id: userId,
        contest_code: data.contest_code || contestId,
        started_at: data.started_at || new Date().toISOString(),
        finished_at: data.finished_at || null,
        status: data.status || 'in_progress',
        total_score: data.total_score || null,
        questions_attempted: data.questions_attempted || 0,
        time_taken: data.time_taken || null,
        updated_at: new Date().toISOString()
      };

      const { data: participant, error } = await supabase
        .from('mega_contest_participants')
        .upsert(participantData, {
          onConflict: 'contest_id,user_id'
        })
        .select()
        .single();

      if (error) throw error;
      return { data: participant, error: null };
    } catch (error: any) {
      console.error('[A4AI] Error upserting participant:', error);
      return { data: null, error: error.message };
    }
  },

  // Get participant info
  async getParticipant(contestId: string, userId: string) {
    try {
      const { data, error } = await supabase
        .from('mega_contest_participants')
        .select('*')
        .eq('contest_id', contestId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return { data, error: null };
    } catch (error: any) {
      console.error('[A4AI] Error fetching participant:', error);
      return { data: null, error: error.message };
    }
  },

  // Get contest statistics
  async getContestStats(contestId: string) {
    try {
      // Total participants
      const { count: totalParticipants, error: countError } = await supabase
        .from('mega_contest_participants')
        .select('*', { count: 'exact', head: true })
        .eq('contest_id', contestId);

      if (countError) throw countError;

      // Average questions attempted
      const { data: participants, error: participantsError } = await supabase
        .from('mega_contest_participants')
        .select('questions_attempted')
        .eq('contest_id', contestId);

      if (participantsError) throw participantsError;

      const totalAttempts = participants?.reduce((sum, p) => sum + (p.questions_attempted || 0), 0) || 0;
      const avgCompletion = participants?.length 
        ? Math.round((totalAttempts / (participants.length * 100)) * 100) 
        : 0;

      return {
        totalParticipants: totalParticipants || 0,
        avgCompletion,
        error: null
      };
    } catch (error: any) {
      console.error('[A4AI] Error fetching contest stats:', error);
      return {
        totalParticipants: 0,
        avgCompletion: 0,
        error: error.message
      };
    }
  },

  // Submit final contest
  async submitContest(
    contestId: string,
    userId: string,
    answers: Record<string, number>
  ) {
    try {
      // Get questions with correct answers
      const { data: questions, error: questionsError } = await this.getContestQuestions(contestId);
      if (questionsError) throw questionsError;

      // Calculate score
      let score = 0;
      let correctCount = 0;
      
      questions?.forEach(question => {
        const userAnswer = answers[question.id];
        if (userAnswer !== undefined && userAnswer === question.correct_answer) {
          score += question.marks || 4;
          correctCount++;
        }
      });

      // Update participant record
      const { data: participant, error: participantError } = await this.upsertParticipant(
        contestId,
        userId,
        {
          finished_at: new Date().toISOString(),
          status: 'completed',
          total_score: score,
          questions_attempted: Object.keys(answers).length
        }
      );

      if (participantError) throw participantError;

      return {
        success: true,
        score,
        correctCount,
        totalQuestions: questions?.length || 0,
        data: participant
      };
    } catch (error: any) {
      console.error('[A4AI] Error submitting contest:', error);
      return {
        success: false,
        score: 0,
        correctCount: 0,
        totalQuestions: 0,
        error: error.message
      };
    }
  },

  // Log proctoring event
  async logProctoringEvent(
    userId: string,
    contestId: string,
    eventType: string,
    eventData?: any
  ) {
    try {
      const { error } = await supabase
        .from('mega_contest_proctoring_events')
        .insert({
          user_id: userId,
          contest_id: contestId,
          event_type: eventType,
          event_data: eventData,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      return { success: true, error: null };
    } catch (error: any) {
      console.error('[A4AI] Error logging proctoring event:', error);
      return { success: false, error: error.message };
    }
  }
};

/** ---------------- PRACTICE MODULE FUNCTIONS (UPDATED) ---------------- */
export const practiceDB = {
  // Get today's practice questions
  async getPracticeQuestions(classId: string, subject: string, limit = 5) {
    try {
      const { data, error } = await supabase
        .from('practice_questions')
        .select('*')
        .eq('class', classId)
        .eq('subject', subject)
        .eq('is_active', true)
        .limit(limit)
        .order('difficulty');
      
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error: any) {
      console.error('[A4AI] Error fetching practice questions:', error);
      return { data: [], error: error.message };
    }
  },

  // Save practice attempt
  async savePracticeAttempt(
    userId: string, 
    questionId: string, 
    selectedOptionIndex: number, 
    isCorrect: boolean
  ) {
    try {
      const coinsEarned = isCorrect ? 5 : 0;
      const today = new Date().toISOString().split('T')[0];
      
      // Save attempt
      const { error: attemptError } = await supabase
        .from('practice_attempts')
        .insert({
          user_id: userId,
          question_id: questionId,
          selected_option_index: selectedOptionIndex,
          is_correct: isCorrect,
          coins_earned: coinsEarned,
          attempt_date: today
        });
      
      if (attemptError) throw attemptError;

      // Update user profile
      const { data: profile } = await supabase
        .from('practice_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profile) {
        // Update existing profile
        const updateData: any = {
          total_coins: (profile.total_coins || 0) + coinsEarned,
          updated_at: new Date().toISOString()
        };

        // Update streak
        const lastPracticeDate = profile.last_practice_date;
        const currentStreak = profile.practice_streak || 0;
        
        if (lastPracticeDate !== today) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          
          updateData.practice_streak = (lastPracticeDate === yesterdayStr) 
            ? currentStreak + 1 
            : 1;
          updateData.last_practice_date = today;
        }

        await supabase
          .from('practice_profiles')
          .update(updateData)
          .eq('id', userId);
      } else {
        // Create new profile
        await supabase
          .from('practice_profiles')
          .insert({
            id: userId,
            total_coins: coinsEarned,
            practice_streak: 1,
            last_practice_date: today
          });
      }

      return { success: true, coinsEarned, error: null };
    } catch (error: any) {
      console.error('[A4AI] Error saving practice attempt:', error);
      return { success: false, coinsEarned: 0, error: error.message };
    }
  },

  // Get user practice profile
  async getUserPracticeProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('practice_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Create profile if doesn't exist
        const { data: newProfile, error: createError } = await supabase
          .from('practice_profiles')
          .insert({
            id: userId,
            total_coins: 0,
            practice_streak: 0,
            last_practice_date: null
          })
          .select()
          .single();

        if (createError) throw createError;
        return { data: newProfile, error: null };
      }

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      console.error('[A4AI] Error getting practice profile:', error);
      return { data: null, error: error.message };
    }
  },

  // Get today's practice stats
  async getTodayPracticeStats(userId: string) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('practice_attempts')
        .select('is_correct, coins_earned')
        .eq('user_id', userId)
        .eq('attempt_date', today);

      if (error) throw error;

      const attempted = data?.length || 0;
      const correct = data?.filter(attempt => attempt.is_correct).length || 0;
      const coins = data?.reduce((sum, attempt) => sum + (attempt.coins_earned || 0), 0) || 0;

      return {
        attempted,
        correct,
        coins,
        accuracy: attempted > 0 ? Math.round((correct / attempted) * 100) : 0,
        error: null
      };
    } catch (error: any) {
      console.error('[A4AI] Error getting practice stats:', error);
      return {
        attempted: 0,
        correct: 0,
        coins: 0,
        accuracy: 0,
        error: error.message
      };
    }
  }
};

/** ---------------- ERROR HANDLING UTILITIES ---------------- */
export const handleSupabaseError = (error: any, context: string) => {
  console.error(`[A4AI] Error in ${context}:`, error);
  
  // Common error messages
  const errorMessages: Record<string, string> = {
    'PGRST116': 'No data found',
    '42501': 'Permission denied',
    '23505': 'Duplicate entry',
    '42P01': 'Table does not exist',
    '08006': 'Connection error'
  };

  const userMessage = errorMessages[error.code] || 
    error.message || 
    'An unexpected error occurred';

  return {
    success: false,
    message: userMessage,
    code: error.code,
    details: error.details || null
  };
};

/** ---------------- INITIALIZATION ---------------- */
// Auto-check connection on module load in development
if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    checkDatabaseConnection().then(result => {
      if (result.connected) {
        console.log('[A4AI] Development: Database connection verified');
      } else {
        console.warn('[A4AI] Development: Database connection issue:', result.error);
      }
    });
  }, 1000);
}