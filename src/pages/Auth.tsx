import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Form } from "@/components/ui/form";
import CustomFormField, { FormFieldType } from "@/components/form/CustomFormField";
import { Mail, Lock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sendWelcomeEmail } from "@/lib/email";
import authLogoIcon from "@/assets/logo_icon.webp";
import { validateEmail } from "@/lib/emailValidation";
import { rateLimitedAuth, rateLimitedSignIn, rateLimitedSignUp } from "@/lib/rateLimitedAuth";
import { isMembershipExemptRole, userNeedsOnboarding } from "@/lib/membershipAccess";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { BackButton } from "@/components/ui/back-button";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import {
  createAuthSchemas,
  type ResetPasswordFormValues,
  type SignInFormValues,
  type SignUpFormValues,
} from "@/lib/schemas/authForm.schema";

async function getPostAuthPath(fallbackPath: string): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) return fallbackPath;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (isMembershipExemptRole(profile?.role)) {
    if (profile?.role === "admin") return "/admin";
    if (profile?.role === "reviewer") return "/reviewer";
    if (profile?.role === "partner") return "/partner";
    return fallbackPath;
  }

  const needsSetup = await userNeedsOnboarding(session.user.id);
  return needsSetup ? "/onboarding" : fallbackPath;
}

function AuthPageLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation("common");
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-subtle px-4">
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
        <BackButton label={t("auth.backToHome")} link="/" />
      </div>
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <LanguageSwitcher />
      </div>
      {children}
    </div>
  );
}

const Auth = () => {
  const { t } = useTranslation("common");
  const { signInSchema, signUpSchema, resetPasswordSchema } = useMemo(
    () => createAuthSchemas(t),
    [t],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Get return URL from location state, or default to dashboard
  const getReturnUrl = () => {
    const from = location.state?.from as { pathname?: string } | undefined;
    return from?.pathname || "/dashboard";
  };

  // Sign In Form
  const signInForm = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Sign Up Form
  const signUpForm = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      passwordConfirmation: "",
    },
  });

  // Reset Password Form
  const resetPasswordForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      passwordConfirmation: "",
    },
  });

  useEffect(() => {
    const checkAuth = async () => {
      // Check for password reset (hash) flow
      const searchParams = new URLSearchParams(window.location.search);

      // Password reset flow (recovery) uses access_token in hash
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get("type");
      const accessToken = hashParams.get("access_token");
      
      if (type === "recovery" && accessToken) {
        // User is coming from password reset email
        // Supabase automatically processes recovery tokens from URL hash
        setIsPasswordReset(true);
        
        // Wait for Supabase to process the token and establish session
        // Check session after a short delay
        setTimeout(async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setIsSessionReady(true);
          } else {
            // If no session after delay, check again
            setTimeout(async () => {
              const { data: { session: retrySession } } = await supabase.auth.getSession();
              setIsSessionReady(!!retrySession);
            }, 1000);
          }
        }, 500);
        return;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session && !isPasswordReset) {
        navigate(await getPostAuthPath(getReturnUrl()));
      }
    };
    checkAuth();

    // Listen for auth state changes (handles the recovery flow)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        // Password recovery token was processed, session should be available
        setIsPasswordReset(true);
        setIsSessionReady(!!session);
        console.log("Password recovery event detected, session:", !!session);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, isPasswordReset, toast]);

  const handleSignUp = async (data: SignUpFormValues) => {
    setIsLoading(true);

    try {
      // Validate email with Abstract API before proceeding
      const emailValidation = await validateEmail(data.email);
      if (!emailValidation.valid) {
        toast({
          title: t("auth.toasts.invalidEmail.title"),
          description: emailValidation.message || t("auth.toasts.invalidEmail.description"),
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const redirectUrl = `${window.location.origin}/onboarding`;

      // Use rateLimitedSignUp which handles rate limiting AND establishes local session
      // This prevents double signup (Edge Function creates user, then we establish session)
      const result = await rateLimitedSignUp(
        data.email,
        data.password,
        {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
          },
        }
      );

      if (result.error) {
        if (result.error.isRateLimited) {
          toast({
            title: t("auth.toasts.tooManyAttempts.title"),
            description: result.error.message,
            variant: "destructive",
          });
        } else if (result.error.message.includes("already registered") || result.error.message.includes("already exists")) {
          toast({
            title: t("auth.toasts.accountExists.title"),
            description: t("auth.toasts.accountExists.description"),
            variant: "destructive",
          });
        } else {
          toast({
            title: t("auth.toasts.signUpFailed.title"),
            description: result.error.message,
            variant: "destructive",
          });
        }
        setIsLoading(false);
        return;
      }

      const signUpData = result.data as { user?: { id: string }; session?: unknown } | null;
      const { data: { session } } = await supabase.auth.getSession();

      if (!signUpData?.user || !session) {
        toast({
          title: t("auth.toasts.accountCreatedSignIn.title"),
          description: t("auth.toasts.accountCreatedSignIn.description"),
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      try {
        await new Promise((resolve) => setTimeout(resolve, 500));

        const { data: existingProfile, error: checkError } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", signUpData.user.id)
          .single();

        if (!existingProfile && checkError?.code === "PGRST116") {
          const { error: profileError } = await supabase.from("profiles").insert({
            user_id: signUpData.user.id,
            first_name: data.firstName,
            last_name: data.lastName,
          });
          if (profileError) {
            console.error("Failed to create profile:", profileError);
          }
        }
      } catch (err) {
        console.log("Profile creation check:", err);
      }

      sendWelcomeEmail(
        data.email,
        `${data.firstName} ${data.lastName}`,
        `${window.location.origin}/onboarding`
      ).catch((err) => console.error("Failed to send welcome email:", err));

      toast({
        title: t("auth.toasts.accountCreated.title"),
        description: t("auth.toasts.accountCreated.description"),
      });
      signUpForm.reset();
      navigate("/onboarding");
    } catch (error) {
      toast({
        title: t("auth.toasts.error.title"),
        description: t("auth.toasts.error.description"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (data: SignInFormValues) => {
    setIsLoading(true);

    try {
      const result = await rateLimitedSignIn(data.email, data.password);

      if (result.error) {
        if (result.error.isRateLimited) {
          toast({
            title: t("auth.toasts.tooManyAttempts.title"),
            description: result.error.message,
            variant: "destructive",
          });
        } else if (result.error.message.includes("Invalid login credentials")) {
          toast({
            title: t("auth.toasts.invalidCredentials.title"),
            description: t("auth.toasts.invalidCredentials.description"),
            variant: "destructive",
          });
        } else {
          toast({
            title: t("auth.toasts.signInFailed.title"),
            description: result.error.message,
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: t("auth.toasts.welcomeBack.title"),
        description: t("auth.toasts.welcomeBack.description"),
      });
      navigate(await getPostAuthPath(getReturnUrl()));
    } catch (error) {
      toast({
        title: t("auth.toasts.error.title"),
        description: t("auth.toasts.error.description"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };


  const handleForgotPassword = async () => {
    const email = signInForm.getValues("email");
    
    if (!email) {
      toast({
        title: t("auth.toasts.emailRequired.title"),
        description: t("auth.toasts.emailRequired.description"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/auth`;

      // Check rate limit via Edge Function first
      const rlResult = await rateLimitedAuth("password_reset", {
        email,
        options: { redirectTo: redirectUrl },
      });

      if (rlResult.error) {
        if (rlResult.error.isRateLimited) {
          toast({
            title: t("auth.toasts.tooManyAttempts.title"),
            description: rlResult.error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: t("auth.toasts.passwordResetFailed.title"),
            description: rlResult.error.message,
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: t("auth.toasts.checkEmail.title"),
        description: t("auth.toasts.checkEmail.description"),
      });
    } catch (error) {
      toast({
        title: t("auth.toasts.error.title"),
        description: t("auth.toasts.error.description"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordUpdate = async (data: ResetPasswordFormValues) => {
    setIsLoading(true);
    try {
      // First, ensure we have a session (Supabase should have established it from the token)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (!session) {
        // If no session, try to get it again (token might still be processing)
        await new Promise(resolve => setTimeout(resolve, 500));
        const { data: { session: retrySession } } = await supabase.auth.getSession();
        
        if (!retrySession) {
          toast({
            title: t("auth.toasts.sessionExpired.title"),
            description: t("auth.toasts.sessionExpired.description"),
            variant: "destructive",
          });
          setIsPasswordReset(false);
          window.history.replaceState(null, "", window.location.pathname);
          return;
        }
      }

      // Update the password
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        toast({
          title: t("auth.toasts.passwordUpdateFailed.title"),
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: t("auth.toasts.passwordUpdated.title"),
          description: t("auth.toasts.passwordUpdated.description"),
        });
        setIsPasswordReset(false);
        // Clear the hash from URL
        window.history.replaceState(null, "", window.location.pathname);
        resetPasswordForm.reset();
      }
    } catch (error) {
      toast({
        title: t("auth.toasts.error.title"),
        description: error instanceof Error ? error.message : t("auth.toasts.error.description"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async () => {
    setIsLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        toast({
          title: t("auth.toasts.googleSignInFailed.title"),
          description: error.message,
          variant: "destructive",
        });
        setIsLoading(false);
      }
      // Note: If successful, user will be redirected to OAuth provider
      // and then back to the app, so we don't need to navigate here
    } catch (error) {
      toast({
        title: t("auth.toasts.error.title"),
        description: t("auth.toasts.error.description"),
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  // Password Reset View
  if (isPasswordReset) {
    return (
      <AuthPageLayout>
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <img src={authLogoIcon} alt={t("auth.brandAlt")} className="w-16 h-16 object-contain" />
            </div>
            <CardTitle className="text-2xl text-center">{t("auth.reset.title")}</CardTitle>
            <CardDescription className="text-center">
              {t("auth.reset.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...resetPasswordForm}>
              <form onSubmit={resetPasswordForm.handleSubmit(handlePasswordUpdate)} className="space-y-4">
                <CustomFormField
                  control={resetPasswordForm.control}
                  name="password"
                  fieldType={FormFieldType.PASSWORD}
                  label={t("auth.fields.newPassword")}
                  placeholder={t("auth.fields.newPasswordPlaceholder")}
                  icon={Lock}
                  iconPosition="left"
                  required
                />
                <PasswordStrengthIndicator
                  password={resetPasswordForm.watch("password") || ""}
                />
                <CustomFormField
                  control={resetPasswordForm.control}
                  name="passwordConfirmation"
                  fieldType={FormFieldType.PASSWORD}
                  label={t("auth.fields.confirmNewPassword")}
                  placeholder={t("auth.fields.confirmNewPasswordPlaceholder")}
                  icon={Lock}
                  iconPosition="left"
                  required
                />
                <Button type="submit" className="w-full" variant="hero" size="lg" disabled={isLoading || !isSessionReady}>
                  {isLoading ? t("auth.buttons.updatingPassword") : !isSessionReady ? t("auth.buttons.verifyingLink") : t("auth.buttons.updatePassword")}
                </Button>
                {!isSessionReady && (
                  <p className="text-sm text-muted-foreground text-center">
                    {t("auth.reset.verifyingLink")}
                  </p>
                )}
              </form>
            </Form>
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsPasswordReset(false);
                  window.history.replaceState(null, "", window.location.pathname);
                }}
                className="text-sm text-primary hover:underline"
              >
                {t("auth.reset.backToSignIn")}
              </button>
            </div>
          </CardContent>
        </Card>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <img src={authLogoIcon} alt={t("auth.brandAlt")} className="w-16 h-16 object-contain" />
          </div>
          <CardTitle className="text-2xl text-center">{t("auth.welcome.title")}</CardTitle>
          <CardDescription className="text-center">
            {t("auth.welcome.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">{t("auth.tabs.signIn")}</TabsTrigger>
              <TabsTrigger value="signup">{t("auth.tabs.signUp")}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin" className="space-y-4">
              {/* OAuth Buttons */}
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleOAuthSignIn()}
                  disabled={isLoading}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  {t("auth.oauth.continueWithGoogle")}
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">{t("auth.oauth.orContinueWith")}</span>
                </div>
              </div>

              <Form {...signInForm}>
                <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-4">
                  <CustomFormField
                    control={signInForm.control}
                    name="email"
                    fieldType={FormFieldType.EMAIL}
                    label={t("auth.fields.email")}
                    placeholder={t("auth.fields.emailPlaceholder")}
                    icon={Mail}
                    iconPosition="left"
                    required
                  />
                  <CustomFormField
                    control={signInForm.control}
                    name="password"
                    fieldType={FormFieldType.PASSWORD}
                    label={t("auth.fields.password")}
                    placeholder={t("auth.fields.passwordPlaceholder")}
                    icon={Lock}
                    iconPosition="left"
                    required
                  />
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={isLoading}
                      className="text-sm text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t("auth.fields.forgotPassword")}
                    </button>
                  </div>
                  <Button type="submit" className="w-full" variant="hero" size="lg" disabled={isLoading}>
                    {isLoading ? t("auth.buttons.signingIn") : t("auth.buttons.signIn")}
                  </Button>
                </form>
              </Form>
            </TabsContent>
            
            <TabsContent value="signup" className="space-y-4">
              {/* OAuth Buttons */}
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleOAuthSignIn}
                  disabled={isLoading}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  {t("auth.oauth.continueWithGoogle")}
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">{t("auth.oauth.orContinueWith")}</span>
                </div>
              </div>

              <Form {...signUpForm}>
                <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <CustomFormField
                      control={signUpForm.control}
                      name="firstName"
                      fieldType={FormFieldType.INPUT}
                      label={t("auth.fields.firstName")}
                      placeholder={t("auth.fields.firstNamePlaceholder")}
                      icon={User}
                      iconPosition="left"
                      required
                    />
                    <CustomFormField
                      control={signUpForm.control}
                      name="lastName"
                      fieldType={FormFieldType.INPUT}
                      label={t("auth.fields.lastName")}
                      placeholder={t("auth.fields.lastNamePlaceholder")}
                      icon={User}
                      iconPosition="left"
                      required
                    />
                  </div>
                  <CustomFormField
                    control={signUpForm.control}
                    name="email"
                    fieldType={FormFieldType.EMAIL}
                    label={t("auth.fields.email")}
                    placeholder={t("auth.fields.emailPlaceholder")}
                    icon={Mail}
                    iconPosition="left"
                    required
                  />
                  <CustomFormField
                    control={signUpForm.control}
                    name="password"
                    fieldType={FormFieldType.PASSWORD}
                    label={t("auth.fields.password")}
                    placeholder={t("auth.fields.passwordCreatePlaceholder")}
                    icon={Lock}
                    iconPosition="left"
                    required
                  />
                  <PasswordStrengthIndicator
                    password={signUpForm.watch("password") || ""}
                  />
                  <CustomFormField
                    control={signUpForm.control}
                    name="passwordConfirmation"
                    fieldType={FormFieldType.PASSWORD}
                    label={t("auth.fields.passwordConfirm")}
                    placeholder={t("auth.fields.passwordConfirmPlaceholder")}
                    icon={Lock}
                    iconPosition="left"
                    required
                  />
                <Button type="submit" className="w-full" variant="hero" size="lg" disabled={isLoading}>
                  {isLoading ? t("auth.buttons.creatingAccount") : t("auth.buttons.createAccount")}
                </Button>
              </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </AuthPageLayout>
  );
};

export default Auth;







