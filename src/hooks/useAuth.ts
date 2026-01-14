import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setSentryUser, clearSentryUser } from "@/lib/sentry";
import { identifyUser, resetUser, trackEvent } from "@/lib/posthog";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Update analytics contexts based on auth state
        if (session?.user) {
          setSentryUser({ id: session.user.id, email: session.user.email });
          identifyUser({ id: session.user.id, email: session.user.email });
          
          if (event === "SIGNED_IN") {
            trackEvent("user_logged_in", { method: "email" });
          }
        } else if (event === "SIGNED_OUT") {
          clearSentryUser();
          resetUser();
          trackEvent("user_logged_out");
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Set initial user context if already logged in
      if (session?.user) {
        setSentryUser({ id: session.user.id, email: session.user.email });
        identifyUser({ id: session.user.id, email: session.user.email });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    user,
    session,
    loading,
    signOut,
  };
};