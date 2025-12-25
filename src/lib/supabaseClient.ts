// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

/** ---------------- Env (soft check) ---------------- */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Don’t crash the entire app in local/dev if env is missing.
  // Use obvious dummy values and log a clear warning instead.
  console.warn(
    "[a4ai] Warning: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. " +
      "Supabase calls will fail until you configure real credentials in .env.local."
  );
}

/** ---------------- Client (stable PKCE auth) ---------------- */
export const supabase = createClient(
  SUPABASE_URL || "https://example.supabase.co",
  SUPABASE_ANON_KEY || "public-anon-key",
  {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
    storage: window.localStorage,
    storageKey: "a4ai.auth.token",
  },
  global: {
    headers: { "x-client-info": "a4ai-web" },
  },
});

/** ---------------- PRACTICE MODULE FUNCTIONS ---------------- */
export const practiceDB = {
  // Get today's practice questions
  async getPracticeQuestions(classId: string, subject: string, limit = 5) {
    try {
      console.log('📡 [practiceDB.getPracticeQuestions] Fetching:', { classId, subject, limit });
      
      const { data, error } = await supabase
        .from('practice_questions')
        .select('*')
        .eq('class', classId)
        .eq('subject', subject)
        .eq('is_active', true)
        .limit(limit)
        .order('difficulty');
      
      if (error) {
        console.error('❌ [practiceDB.getPracticeQuestions] Supabase error:', error);
        throw error;
      }
      
      console.log('✅ [practiceDB.getPracticeQuestions] Success:', { 
        count: data?.length || 0,
        sample: data?.[0] 
      });
      return data || [];
    } catch (error) {
      console.error('🔥 [practiceDB.getPracticeQuestions] Error:', error);
      return [];
    }
  },

  // Save practice attempt
  async savePracticeAttempt(
    userId: string, 
    questionId: string, 
    selectedOptionIndex: number, 
    isCorrect: boolean
  ) {
    const coinsEarned = isCorrect ? 5 : 0;
    const today = new Date().toISOString().split('T')[0];
    
    console.log('💾 [practiceDB.savePracticeAttempt] Saving:', {
      userId,
      questionId,
      selectedOptionIndex,
      isCorrect,
      coinsEarned,
      today
    });
    
    try {
      // Save attempt to practice_attempts table
      const { error } = await supabase
        .from('practice_attempts')
        .insert({
          user_id: userId,
          question_id: questionId,
          selected_option_index: selectedOptionIndex,
          is_correct: isCorrect,
          coins_earned: coinsEarned,
          attempt_date: today
        });
      
      if (error) {
        console.error('❌ [practiceDB.savePracticeAttempt] Error saving attempt:', error);
        throw error;
      }

      // Update coins if correct
      if (coinsEarned > 0) {
        console.log('💰 [practiceDB.savePracticeAttempt] Updating coins...');
        
        // First, get current coins
        const { data: profile, error: profileError } = await supabase
          .from('practice_profiles')
          .select('total_coins')
          .eq('id', userId)
          .single();

        if (profileError && profileError.code === 'PGRST116') {
          // Profile doesn't exist, create it with coins
          const { error: insertError } = await supabase
            .from('practice_profiles')
            .insert({ 
              id: userId,
              total_coins: coinsEarned,
              practice_streak: 0,
              last_practice_date: today
            });
          
          if (insertError) {
            console.error('❌ [practiceDB.savePracticeAttempt] Error creating profile:', insertError);
            throw insertError;
          }
        } else if (profileError) {
          console.error('❌ [practiceDB.savePracticeAttempt] Error getting profile:', profileError);
          throw profileError;
        } else {
          // Profile exists, update coins
          const { error: updateError } = await supabase
            .from('practice_profiles')
            .update({ 
              total_coins: (profile.total_coins || 0) + coinsEarned 
            })
            .eq('id', userId);
          
          if (updateError) {
            console.error('❌ [practiceDB.savePracticeAttempt] Error updating coins:', updateError);
            throw updateError;
          }
        }
      }

      // Update streak - check if user practiced today
      console.log('📅 [practiceDB.savePracticeAttempt] Checking streak...');
      const { data: profile, error: streakError } = await supabase
        .from('practice_profiles')
        .select('last_practice_date, practice_streak, total_coins')
        .eq('id', userId)
        .single();

      if (streakError && streakError.code !== 'PGRST116') {
        console.error('❌ [practiceDB.savePracticeAttempt] Error getting streak:', streakError);
      }

      if (!streakError && profile) {
        const lastPracticeDate = profile?.last_practice_date;
        const currentStreak = profile?.practice_streak || 0;
        
        // If last practice wasn't today, update streak
        if (lastPracticeDate !== today) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          
          const newStreak = (lastPracticeDate === yesterdayStr) 
            ? currentStreak + 1 
            : 1; // Reset streak if missed a day
          
          await supabase
            .from('practice_profiles')
            .upsert({
              id: userId,
              last_practice_date: today,
              practice_streak: newStreak,
              total_coins: coinsEarned > 0 ? ((profile.total_coins || 0) + coinsEarned) : (profile.total_coins || 0)
            });
        }
      }

      console.log('✅ [practiceDB.savePracticeAttempt] Successfully saved');
      return { success: true, coinsEarned };
    } catch (error) {
      console.error('🔥 [practiceDB.savePracticeAttempt] Error:', error);
      return { success: false, coinsEarned: 0 };
    }
  },

  // Get or create user practice profile
  async getUserPracticeProfile(userId: string) {
    console.log('👤 [practiceDB.getUserPracticeProfile] Fetching for:', userId);
    
    try {
      // Try to get existing profile
      const { data, error } = await supabase
        .from('practice_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      // If profile doesn't exist, create one
      if (error && error.code === 'PGRST116') {
        console.log('📝 [practiceDB.getUserPracticeProfile] Profile not found, creating...');
        
        const { data: newProfile, error: insertError } = await supabase
          .from('practice_profiles')
          .insert({ 
            id: userId,
            total_coins: 0,
            practice_streak: 0,
            last_practice_date: null
          })
          .select()
          .single();
        
        if (insertError) {
          console.error('❌ [practiceDB.getUserPracticeProfile] Error creating profile:', insertError);
          throw insertError;
        }
        
        console.log('✅ [practiceDB.getUserPracticeProfile] Created new profile:', newProfile);
        return newProfile;
      }
      
      if (error) {
        console.error('❌ [practiceDB.getUserPracticeProfile] Error:', error);
        throw error;
      }
      
      console.log('✅ [practiceDB.getUserPracticeProfile] Found profile:', data);
      return data;
    } catch (error) {
      console.error('🔥 [practiceDB.getUserPracticeProfile] Error:', error);
      return null;
    }
  },

  // Check today's attempts count
  async getTodayAttemptsCount(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    
    console.log('📊 [practiceDB.getTodayAttemptsCount] Checking for:', { userId, today });
    
    const { count, error } = await supabase
      .from('practice_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('attempt_date', today);
    
    if (error) {
      console.error('❌ [practiceDB.getTodayAttemptsCount] Error:', error);
      return 0;
    }
    
    console.log('✅ [practiceDB.getTodayAttemptsCount] Count:', count || 0);
    return count || 0;
  },

  // Get user's practice stats
  async getUserPracticeStats(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    
    console.log('📈 [practiceDB.getUserPracticeStats] Getting stats for:', { userId, today });
    
    const { data, error } = await supabase
      .from('practice_attempts')
      .select('is_correct, coins_earned')
      .eq('user_id', userId)
      .eq('attempt_date', today);
    
    if (error) {
      console.error('❌ [practiceDB.getUserPracticeStats] Error:', error);
      return { attempted: 0, correct: 0, coins: 0 };
    }
    
    const attempted = data?.length || 0;
    const correct = data?.filter(attempt => attempt.is_correct).length || 0;
    const coins = data?.reduce((sum, attempt) => sum + (attempt.coins_earned || 0), 0) || 0;
    
    console.log('✅ [practiceDB.getUserPracticeStats] Stats:', { attempted, correct, coins });
    return { attempted, correct, coins };
  },

  // Get questions attempted today
  async getQuestionsAttemptedToday(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    
    console.log('📋 [practiceDB.getQuestionsAttemptedToday] Getting for:', { userId, today });
    
    const { data, error } = await supabase
      .from('practice_attempts')
      .select('question_id')
      .eq('user_id', userId)
      .eq('attempt_date', today);
    
    if (error) {
      console.error('❌ [practiceDB.getQuestionsAttemptedToday] Error:', error);
      return [];
    }
    
    const questionIds = data?.map(item => item.question_id) || [];
    console.log('✅ [practiceDB.getQuestionsAttemptedToday] Found:', questionIds.length, 'questions');
    return questionIds;
  },

  // Get all questions (for debugging)
  async getAllQuestions() {
    console.log('🔍 [practiceDB.getAllQuestions] Getting all questions...');
    
    const { data, error } = await supabase
      .from('practice_questions')
      .select('*')
      .limit(50);
    
    if (error) {
      console.error('❌ [practiceDB.getAllQuestions] Error:', error);
      return [];
    }
    
    console.log('✅ [practiceDB.getAllQuestions] Found:', data?.length || 0, 'questions');
    return data || [];
  },

  // Direct Supabase query for debugging
  async debugQuery(query: string) {
    console.log('🔧 [practiceDB.debugQuery] Running:', query);
    
    try {
      const { data, error } = await supabase.rpc('exec_sql', { query });
      
      if (error) {
        console.error('❌ [practiceDB.debugQuery] RPC error:', error);
        
        // Fallback to direct fetch
        console.log('🔄 [practiceDB.debugQuery] Trying fallback...');
        return { error: error.message };
      }
      
      console.log('✅ [practiceDB.debugQuery] Success:', data);
      return { data };
    } catch (error: any) {
      console.error('🔥 [practiceDB.debugQuery] Error:', error);
      return { error: error.message };
    }
  }
};