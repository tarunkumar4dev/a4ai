// src/providers/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

// Extended user profile type
export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  class?: string;
  avatar_url?: string;
  total_coins?: number;
  practice_streak?: number;
  created_at?: string;
  updated_at?: string;
}

type AuthContextType = {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, fullName: string, className: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// User profile helper functions
const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      // Profile might not exist yet, create a default one
      if (error.code === 'PGRST116') {
        const userEmail = (await supabase.auth.getUser()).data.user?.email || '';
        
        const defaultProfile: UserProfile = {
          id: userId,
          email: userEmail,
          full_name: 'Student',
          class: '10',
          total_coins: 0,
          practice_streak: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from('profiles')
          .insert(defaultProfile);

        if (insertError) {
          console.error('[A4AI] Error creating default profile:', insertError);
          return null;
        }

        return defaultProfile;
      }
      
      console.error('[A4AI] Error fetching user profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[A4AI] Unexpected error fetching profile:', error);
    return null;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        setLoading(true);
        
        // Get current session
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[A4AI] Error getting session:', sessionError);
          if (mounted) {
            setSession(null);
            setUser(null);
            setUserProfile(null);
          }
          return;
        }

        if (currentSession && mounted) {
          setSession(currentSession);
          setUser(currentSession.user);

          // Fetch user profile
          const profile = await fetchUserProfile(currentSession.user.id);
          if (mounted) {
            setUserProfile(profile);
          }
        } else if (mounted) {
          setSession(null);
          setUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        console.error('[A4AI] Error initializing auth:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
          setUserProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;

        console.log('[A4AI] Auth state changed:', event);
        
        setSession(currentSession);
        setUser(currentSession?.user || null);

        if (currentSession?.user) {
          const profile = await fetchUserProfile(currentSession.user.id);
          setUserProfile(profile);
        } else {
          setUserProfile(null);
        }

        // Show toast for certain events
        switch (event) {
          case 'SIGNED_IN':
            toast.success('Successfully signed in!');
            break;
          case 'SIGNED_OUT':
            toast.info('Signed out successfully');
            break;
          case 'USER_UPDATED':
            toast.success('Profile updated successfully');
            break;
          case 'TOKEN_REFRESHED':
            // Silent refresh, no toast needed
            break;
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sign in function
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim()
      });

      if (error) {
        let errorMessage = 'Failed to sign in';
        
        switch (error.message) {
          case 'Invalid login credentials':
            errorMessage = 'Invalid email or password';
            break;
          case 'Email not confirmed':
            errorMessage = 'Please confirm your email address first';
            break;
          case 'Network error':
            errorMessage = 'Network error. Please check your connection';
            break;
        }

        toast.error(errorMessage);
        return { success: false, error: errorMessage };
      }

      return { success: true };
    } catch (error: any) {
      console.error('[A4AI] Sign in error:', error);
      toast.error('An unexpected error occurred');
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, []);

  // Sign up function
  const signUp = useCallback(async (email: string, password: string, fullName: string, className: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            full_name: fullName.trim(),
            class: className
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        let errorMessage = 'Failed to create account';
        
        switch (error.message) {
          case 'User already registered':
            errorMessage = 'An account with this email already exists';
            break;
          case 'Password should be at least 6 characters':
            errorMessage = 'Password must be at least 6 characters long';
            break;
          case 'Unable to validate email address: invalid format':
            errorMessage = 'Please enter a valid email address';
            break;
        }

        toast.error(errorMessage);
        return { success: false, error: errorMessage };
      }

      if (data.user) {
        // Create user profile
        const profile: UserProfile = {
          id: data.user.id,
          email: email.trim(),
          full_name: fullName.trim(),
          class: className,
          total_coins: 100, // Starting bonus
          practice_streak: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(profile);

        if (profileError) {
          console.error('[A4AI] Error creating profile:', profileError);
        }
      }

      toast.success('Account created successfully! Please check your email to confirm your account.');
      return { success: true };
    } catch (error: any) {
      console.error('[A4AI] Sign up error:', error);
      toast.error('An unexpected error occurred');
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, []);

  // Sign out function
  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('[A4AI] Sign out error:', error);
        toast.error('Failed to sign out');
      }
    } catch (error) {
      console.error('[A4AI] Sign out error:', error);
      toast.error('An unexpected error occurred');
    }
  }, []);

  // Refresh session function
  const refreshSession = useCallback(async () => {
    try {
      const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('[A4AI] Error refreshing session:', error);
        return;
      }

      setSession(refreshedSession);
      setUser(refreshedSession?.user || null);
      
      if (refreshedSession?.user) {
        const profile = await fetchUserProfile(refreshedSession.user.id);
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('[A4AI] Error refreshing session:', error);
    }
  }, []);

  // Update profile function
  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) {
        console.error('[A4AI] Error updating profile:', error);
        toast.error('Failed to update profile');
        return { success: false, error: error.message };
      }

      // Update local state
      setUserProfile(prev => prev ? { ...prev, ...updateData } : null);
      toast.success('Profile updated successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[A4AI] Error updating profile:', error);
      toast.error('An unexpected error occurred');
      return { success: false, error: error.message };
    }
  }, [user]);

  // Session timeout handler
  useEffect(() => {
    const checkSessionExpiry = () => {
      if (session?.expires_at) {
        const expiresAt = new Date(session.expires_at).getTime();
        const now = Date.now();
        const timeLeft = expiresAt - now;

        // Warn user 5 minutes before expiry
        if (timeLeft > 0 && timeLeft < 5 * 60 * 1000) {
          toast.warning('Your session will expire soon. Please save your work.', {
            duration: 10000
          });
        }

        // Refresh session 1 minute before expiry
        if (timeLeft > 0 && timeLeft < 60 * 1000) {
          refreshSession();
        }
      }
    };

    const interval = setInterval(checkSessionExpiry, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [session, refreshSession]);

  const value: AuthContextType = {
    session,
    user,
    userProfile,
    loading,
    signIn,
    signUp,
    signOut,
    refreshSession,
    updateProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

// Helper hook for protected routes
export function useRequireAuth() {
  const { session, loading } = useAuth();
  
  useEffect(() => {
    if (!loading && !session) {
      // Redirect to login if not authenticated
      window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
    }
  }, [session, loading]);

  return { session, loading };
}