import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for hash fragments (OAuth tokens)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const errorParam = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');

        // If there's an error in the callback
        if (errorParam) {
          setError(errorDescription || errorParam || 'Authentication failed');
          setTimeout(() => {
            navigate('/auth', { replace: true });
          }, 3000);
          return;
        }

        // Supabase automatically processes hash fragments when getSession is called
        // Wait a moment for Supabase to process the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          setError(sessionError.message);
          setTimeout(() => {
            navigate('/auth', { replace: true });
          }, 3000);
          return;
        }

        if (session) {
          // Clean up the hash from URL before navigating
          window.history.replaceState(null, '', '/auth/callback');
          
          // Small delay to ensure session is fully established
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 100);
        } else {
          // No session established, redirect to auth
          setError('Failed to establish session. Please try again.');
          setTimeout(() => {
            navigate('/auth', { replace: true });
          }, 3000);
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        setTimeout(() => {
          navigate('/auth', { replace: true });
        }, 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {error ? (
            <div className="text-center space-y-4">
              <div className="text-destructive font-semibold">Authentication Error</div>
              <p className="text-sm text-muted-foreground">{error}</p>
              <p className="text-xs text-muted-foreground">Redirecting to sign in...</p>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <div className="font-semibold">Completing sign in...</div>
              <p className="text-sm text-muted-foreground">Please wait while we finish setting up your account.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OAuthCallback;









