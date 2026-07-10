import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { userNeedsOnboarding } from '@/lib/membershipAccess';
import { sendWelcomeEmail } from '@/lib/email';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/ui/language-switcher';

async function ensureProfileForUser(
  userId: string,
  userMetadata: Record<string, unknown> | null,
): Promise<{ firstName: string | null; lastName: string | null }> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  const meta = userMetadata ?? {};
  let firstName: string | null = (meta.first_name as string) ?? null;
  let lastName: string | null = (meta.last_name as string) ?? null;
  const fullName = (meta.full_name as string) ?? (meta.name as string);
  if ((!firstName && !lastName) && fullName && typeof fullName === 'string') {
    const parts = fullName.trim().split(/\s+/);
    firstName = parts[0] ?? null;
    lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;
  }

  if (existing) return { firstName, lastName };

  await supabase.from('profiles').insert({
    user_id: userId,
    first_name: firstName || null,
    last_name: lastName || null,
  });

  return { firstName, lastName };
}

/**
 * A `profiles` row always exists by the time this runs (the `on_auth_user_created`
 * DB trigger inserts it synchronously on signup), so presence of a profile can't be
 * used to detect a first-time signup. Instead compare timestamps Supabase sets on
 * the user: for a brand-new account `created_at` and `last_sign_in_at` are the same
 * instant; a returning user's `last_sign_in_at` is well after `created_at`.
 */
function isNewSignup(user: { created_at: string; last_sign_in_at?: string | null }): boolean {
  if (!user.last_sign_in_at) return true;
  const createdAt = new Date(user.created_at).getTime();
  const lastSignInAt = new Date(user.last_sign_in_at).getTime();
  return Math.abs(lastSignInAt - createdAt) < 10_000;
}

const OAuthCallback = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const errorParam = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');
        const decodeAuthMessage = (msg: string | null) =>
          msg ? decodeURIComponent(msg.replace(/\+/g, ' ')) : null;

        if (errorParam) {
          setError(decodeAuthMessage(errorDescription) || errorParam || t('auth.oauthCallback.authFailed'));
          setTimeout(() => {
            navigate('/auth', { replace: true });
          }, 3000);
          return;
        }

        const authCode = new URLSearchParams(window.location.search).get('code');
        let exchangeErrorMessage: string | null = null;

        let { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (!session && authCode) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
          if (exchangeError) {
            exchangeErrorMessage =
              decodeAuthMessage(exchangeError.message) || exchangeError.message;
          }
          const refreshed = await supabase.auth.getSession();
          session = refreshed.data.session;
          sessionError = refreshed.error;
        }

        if (sessionError) {
          setError(sessionError.message);
          setTimeout(() => {
            navigate('/auth', { replace: true });
          }, 3000);
          return;
        }

        if (session) {
          window.history.replaceState(null, '', '/auth/callback');

          const userEmail = session.user.email;
          if (!userEmail) {
            await supabase.auth.signOut();
            setError(t('auth.oauthCallback.noEmail'));
            setTimeout(() => {
              navigate('/auth', { replace: true });
            }, 3000);
            return;
          }

          try {
            const { firstName, lastName } = await ensureProfileForUser(
              session.user.id,
              session.user.user_metadata,
            );
            if (isNewSignup(session.user)) {
              const recipientName = [firstName, lastName].filter(Boolean).join(' ') || userEmail;
              sendWelcomeEmail(
                userEmail,
                recipientName,
                `${window.location.origin}/onboarding`,
              ).catch((err) => console.error('Failed to send welcome email:', err));
            }
          } catch (profileErr) {
            if ((profileErr as { code?: string })?.code !== '23505') {
              console.warn('OAuth callback: ensure profile', profileErr);
            }
          }

          const destination = (await userNeedsOnboarding(session.user.id))
            ? '/onboarding'
            : '/dashboard';
          setTimeout(() => {
            navigate(destination, { replace: true });
          }, 100);
        } else {
          setError(
            exchangeErrorMessage || t('auth.oauthCallback.sessionFailed'),
          );
          setTimeout(() => {
            navigate('/auth', { replace: true });
          }, 3000);
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError(err instanceof Error ? err.message : t('auth.toasts.error.description'));
        setTimeout(() => {
          navigate('/auth', { replace: true });
        }, 3000);
      }
    };

    handleCallback();
  }, [navigate, t]);

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-background">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {error ? (
            <div className="text-center space-y-4">
              <div className="text-destructive font-semibold">{t('auth.oauthCallback.errorTitle')}</div>
              <p className="text-sm text-muted-foreground">{error}</p>
              <p className="text-xs text-muted-foreground">{t('auth.oauthCallback.redirecting')}</p>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <div className="font-semibold">{t('auth.oauthCallback.completing')}</div>
              <p className="text-sm text-muted-foreground">{t('auth.oauthCallback.pleaseWait')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OAuthCallback;
