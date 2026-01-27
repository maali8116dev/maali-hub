import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { emailSchema } from "@/lib/emailValidation";

// Form schemas
const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const signUpSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: emailSchema,
  password: z.string().min(6, "Password must be at least 6 characters"),
  passwordConfirmation: z.string().min(6, "Password confirmation is required"),
}).refine((data) => data.password === data.passwordConfirmation, {
  message: "Passwords do not match",
  path: ["passwordConfirmation"],
});

const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  passwordConfirmation: z.string().min(6, "Password confirmation is required"),
}).refine((data) => data.password === data.passwordConfirmation, {
  message: "Passwords do not match",
  path: ["passwordConfirmation"],
});

type SignInFormValues = z.infer<typeof signInSchema>;
type SignUpFormValues = z.infer<typeof signUpSchema>;
type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
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

  // Check if user is already logged in or arriving from password reset/magic link
  useEffect(() => {
    const checkAuth = async () => {
      // Check for password reset or magic link flow (token in URL)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get("type");
      const accessToken = hashParams.get("access_token");
      
      if (type === "recovery" && accessToken) {
        // User is coming from password reset email
        setIsPasswordReset(true);
        return;
      }
      
      // ARCHIVED: Magic link callback handling - uncomment to re-enable
      // Handle magic link callback
      /*
      if (type === "magiclink" && accessToken) {
        // Magic link callback - wait for Supabase to process the token
        // The onAuthStateChange listener will handle the actual sign-in
        // Just clear the hash from URL
        window.history.replaceState(null, "", window.location.pathname);
        return;
      }
      */
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session && !isPasswordReset) {
        // If user is already logged in, redirect to return URL or dashboard
        navigate(getReturnUrl());
      }
    };
    checkAuth();

    // Listen for auth state changes (handles the recovery and magic link flow)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordReset(true);
      } else if (event === "SIGNED_IN" && session) {
        // ARCHIVED: Magic link sign-in handling - uncomment to re-enable
        /*
        // Handle magic link sign-in
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = hashParams.get("type");
        const urlParams = new URLSearchParams(window.location.search);
        const returnTo = urlParams.get("returnTo");
        
        if (type === "magiclink") {
          toast({
            title: "Welcome!",
            description: "You've been signed in successfully.",
          });
          // Use returnTo from URL if available, otherwise use getReturnUrl()
          const redirectPath = returnTo || getReturnUrl();
          navigate(redirectPath);
          // Clear the hash and query params from URL
          window.history.replaceState(null, "", window.location.pathname);
        }
        */
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, isPasswordReset, toast]);

  const handleSignUp = async (data: SignUpFormValues) => {
    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/dashboard`;
      
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast({
            title: "Account already exists",
            description: "Please sign in with your existing account or use a different email.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Sign up failed",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        // Check if user was automatically signed in (session exists)
        const hasSession = !!signUpData?.session;
        const newUser = signUpData?.user;
        
        // Ensure profile is created (fallback if trigger hasn't run yet)
        if (newUser) {
          try {
            // Wait a moment for trigger to potentially create profile
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Check if profile exists, if not create it
            const { data: existingProfile, error: checkError } = await supabase
              .from("profiles")
              .select("id")
              .eq("user_id", newUser.id)
              .single();
            
            if (!existingProfile && checkError?.code === 'PGRST116') {
              // Profile doesn't exist yet, create it directly
              const { error: profileError } = await supabase
                .from("profiles")
                .insert({
                  user_id: newUser.id,
                  first_name: data.firstName,
                  last_name: data.lastName,
                });
              
              if (profileError) {
                console.error("Failed to create profile:", profileError);
                // Continue anyway - trigger might create it later
              }
            }
          } catch (err) {
            // Profile might already exist or trigger is creating it
            console.log("Profile creation check:", err);
          }
        }
        
        // Send welcome email after signup (async, don't block)
        sendWelcomeEmail(
          data.email,
          `${data.firstName} ${data.lastName}`,
          `${window.location.origin}/projects`
        ).catch(err => console.error("Failed to send welcome email:", err));
        
        if (hasSession) {
          // User is signed in (email auto-confirmed or confirmation disabled)
          toast({
            title: "Account created!",
            description: "Welcome! You've been signed in.",
          });
          signUpForm.reset();
          
          // Mark that user just signed up to show profile wizard
          localStorage.setItem('justSignedUp', 'true');
          
          // Redirect to return URL or dashboard
          navigate(getReturnUrl());
        } else {
          // Email confirmation required, but allow access anyway
          // Sign the user in programmatically if possible
          // Note: This requires Supabase to be configured to allow unverified sign-ins
          try {
            // Try to sign in with the credentials to get a session
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email: data.email,
              password: data.password,
            });
            
            if (signInError) {
              // If sign-in fails, user needs to verify email first
              toast({
                title: "Account created!",
                description: "Please check your email to verify your account. You can access the dashboard after verification.",
              });
            } else {
              // Successfully signed in (Supabase allows unverified sign-ins)
              toast({
                title: "Account created!",
                description: "Welcome! Please verify your email to submit applications.",
              });
              signUpForm.reset();
              localStorage.setItem('justSignedUp', 'true');
              navigate(getReturnUrl());
            }
          } catch (err) {
            // Fallback: show message but don't redirect
            toast({
              title: "Account created!",
              description: "Please check your email to verify your account.",
            });
          }
          signUpForm.reset();
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (data: SignInFormValues) => {
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Invalid credentials",
            description: "Please check your email and password and try again.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Sign in failed",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Welcome back!",
          description: "You have successfully signed in.",
        });
        navigate(getReturnUrl());
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ARCHIVED: Magic link sign-in handler - uncomment to re-enable
  const handleMagicLinkSignIn = async () => {
    const email = signInForm.getValues("email");
    
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address first.",
        variant: "destructive",
      });
      return;
    }

    // Validate email format (basic validation, not using emailSchema to avoid blocking legitimate emails)
    try {
      signInSchema.parse({ email, password: "dummy" }); // Just validate email format
    } catch (error) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Use a simple redirect URL (must be whitelisted in Supabase dashboard)
      const redirectUrl = `${window.location.origin}/auth`;
      
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        console.error("Magic link error:", error);
        
        // Provide more specific error messages
        let errorMessage = error.message;
        if (error.message.includes("email rate limit")) {
          errorMessage = "Too many requests. Please wait a few minutes before trying again.";
        } else if (error.message.includes("redirect")) {
          errorMessage = "Redirect URL not configured. Please contact support.";
        } else if (error.message.includes("email")) {
          errorMessage = "Unable to send email. Please check your email address and try again.";
        }
        
        toast({
          title: "Failed to send magic link",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        // Success - magic link sent
        toast({
          title: "Check your email",
          description: "We've sent you a magic link. Click the link in the email to sign in.",
        });
      }
    } catch (error) {
      console.error("Magic link exception:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred. Please try again.",
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
        title: "Email required",
        description: "Please enter your email address first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/auth`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast({
          title: "Password reset failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Check your email",
          description: "We've sent you a password reset link. Please check your inbox.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordUpdate = async (data: ResetPasswordFormValues) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        toast({
          title: "Password update failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password updated!",
          description: "Your password has been successfully updated. You can now sign in.",
        });
        setIsPasswordReset(false);
        // Clear the hash from URL
        window.history.replaceState(null, "", window.location.pathname);
        resetPasswordForm.reset();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: "google" | "facebook") => {
    setIsLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/dashboard`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        toast({
          title: `${provider === "google" ? "Google" : "Facebook"} sign in failed`,
          description: error.message,
          variant: "destructive",
        });
        setIsLoading(false);
      }
      // Note: If successful, user will be redirected to OAuth provider
      // and then back to the app, so we don't need to navigate here
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  // Password Reset View
  if (isPasswordReset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-gradient-primary text-white">
                <span className="text-2xl font-bold">M</span>
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Set New Password</CardTitle>
            <CardDescription className="text-center">
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...resetPasswordForm}>
              <form onSubmit={resetPasswordForm.handleSubmit(handlePasswordUpdate)} className="space-y-4">
                <CustomFormField
                  control={resetPasswordForm.control}
                  name="password"
                  fieldType={FormFieldType.PASSWORD}
                  label="New Password"
                  placeholder="Enter your new password"
                  icon={Lock}
                  iconPosition="left"
                  required
                />
                <CustomFormField
                  control={resetPasswordForm.control}
                  name="passwordConfirmation"
                  fieldType={FormFieldType.PASSWORD}
                  label="Confirm New Password"
                  placeholder="Re-enter your new password"
                  icon={Lock}
                  iconPosition="left"
                  required
                />
                <Button type="submit" className="w-full" variant="hero" size="lg" disabled={isLoading}>
                  {isLoading ? "Updating password..." : "Update Password"}
                </Button>
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
                Back to Sign In
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          {/* Logo Placeholder */}
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-gradient-primary text-white">
              <span className="text-2xl font-bold">M</span>
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Welcome</CardTitle>
          <CardDescription className="text-center">
            Join the community of African entrepreneurs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin" className="space-y-4">
              {/* OAuth Buttons */}
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleOAuthSignIn("google")}
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
                  Continue with Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleOAuthSignIn("facebook")}
                  disabled={isLoading}
                >
                  <svg className="mr-2 h-4 w-4" fill="#1877F2" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  Continue with Facebook
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <Form {...signInForm}>
                <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-4">
                  <CustomFormField
                    control={signInForm.control}
                    name="email"
                    fieldType={FormFieldType.EMAIL}
                    label="Email"
                    placeholder="your@email.com"
                    icon={Mail}
                    iconPosition="left"
                    required
                  />
                  <CustomFormField
                    control={signInForm.control}
                    name="password"
                    fieldType={FormFieldType.PASSWORD}
                    label="Password"
                    placeholder="Enter your password"
                    icon={Lock}
                    iconPosition="left"
                    required
                  />
                  <div className="flex items-center justify-end">
                    {/* ARCHIVED: Magic link sign-in - uncomment to re-enable
                    <button
                      type="button"
                      onClick={handleMagicLinkSignIn}
                      disabled={isLoading}
                      className="text-sm text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Sign in with magic link
                    </button>
                    */}
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={isLoading}
                      className="text-sm text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Button type="submit" className="w-full" variant="hero" size="lg" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Sign In"}
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
                  onClick={() => handleOAuthSignIn("google")}
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
                  Continue with Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleOAuthSignIn("facebook")}
                  disabled={isLoading}
                >
                  <svg className="mr-2 h-4 w-4" fill="#1877F2" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  Continue with Facebook
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <Form {...signUpForm}>
                <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <CustomFormField
                      control={signUpForm.control}
                      name="firstName"
                      fieldType={FormFieldType.INPUT}
                      label="First Name"
                      placeholder="John"
                      icon={User}
                      iconPosition="left"
                      required
                    />
                    <CustomFormField
                      control={signUpForm.control}
                      name="lastName"
                      fieldType={FormFieldType.INPUT}
                      label="Last Name"
                      placeholder="Doe"
                      icon={User}
                      iconPosition="left"
                      required
                    />
                  </div>
                  <CustomFormField
                    control={signUpForm.control}
                    name="email"
                    fieldType={FormFieldType.EMAIL}
                    label="Email"
                    placeholder="your@email.com"
                    icon={Mail}
                    iconPosition="left"
                    required
                  />
                  <CustomFormField
                    control={signUpForm.control}
                    name="password"
                    fieldType={FormFieldType.PASSWORD}
                    label="Password"
                    placeholder="Create a strong password"
                    icon={Lock}
                    iconPosition="left"
                    required
                  />
                  <CustomFormField
                    control={signUpForm.control}
                    name="passwordConfirmation"
                    fieldType={FormFieldType.PASSWORD}
                    label="Confirm Password"
                    placeholder="Re-enter your password"
                    icon={Lock}
                    iconPosition="left"
                    required
                  />
                <Button type="submit" className="w-full" variant="hero" size="lg" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;