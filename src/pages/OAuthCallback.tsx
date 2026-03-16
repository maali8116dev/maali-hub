import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/** Ensure a profile row exists for the current user (fallback when DB trigger has not run yet, e.g. OAuth). */
async function ensureProfileForUser(userId: string, userMetadata: Record<string, unknown> | null): Promise<void> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (existing) return;

  const meta = userMetadata ?? {};
  let firstName: string | null = (meta.first_name as string) ?? null;
  let lastName: string | null = (meta.last_name as string) ?? null;
  const fullName = (meta.full_name as string) ?? (meta.name as string);
  if ((!firstName && !lastName) && fullName && typeof fullName === 'string') {
    const parts = fullName.trim().split(/\s+/);
    firstName = parts[0] ?? null;
    lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
  }

  await supabase.from('profiles').insert({
    user_id: userId,
    first_name: firstName || null,
    last_name: lastName || null,
  });
}

const OAuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const errorParam = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');

        if (errorParam) {
          setError(errorDescription || errorParam || 'Authentication failed');
          setTimeout(() => {
            navigate('/auth', { replace: true });
          }, 3000);
          return;
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          setError(sessionError.message);
          setTimeout(() => {
            navigate('/auth', { replace: true });
          }, 3000);
          return;
        }

        if (session) {
          window.history.replaceState(null, '', '/auth/callback');

          // Ensure profile exists (trigger may not have run yet for OAuth signups)
          try {
            await ensureProfileForUser(session.user.id, session.user.user_metadata);
          } catch (profileErr) {
            // Ignore unique violation (profile created by trigger); log others
            if ((profileErr as { code?: string })?.code !== '23505') {
              console.warn('OAuth callback: ensure profile', profileErr);
            }
          }

          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 100);
        } else {
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









