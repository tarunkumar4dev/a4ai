import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleAuth = async () => {
      try {
        // Get the session from URL fragments
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (session) {
          // Ensure we have a valid user
          const { data: { user } } = await supabase.auth.getUser();
          
          if (!user) throw new Error("User not found after authentication");

          // Create/update profile if needed
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || 'New User',
              role: 'teacher'
            });

          if (profileError) throw profileError;

          // Add small delay to ensure session persistence
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Redirect back to login with state
          navigate('/login', { 
            replace: true,
            state: { from: 'oauth-callback' } 
          });
        } else {
          navigate('/login', { 
            replace: true,
            state: { error: 'Authentication failed' } 
          });
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        navigate('/login', { 
          replace: true,
          state: { 
            error: error instanceof Error ? error.message : 'Authentication error' 
          } 
        });
      }
    };

    handleAuth();
  }, [navigate, toast]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Completing authentication...</h2>
        <p className="text-gray-500 mt-2">Please wait while we verify your session</p>
      </div>
    </div>
  );
}