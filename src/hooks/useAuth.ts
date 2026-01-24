import { useState, useEffect, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setSentryUser, clearSentryUser } from "@/lib/sentry";
import { identifyUser, resetUser, trackEvent } from "@/lib/posthog";
import { logActivityDirect } from "./useActivityLogger";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const lastLoggedUserIdRef = useRef<string | null>(null);
  const lastLoginLogTimeRef = useRef<number>(0);

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
            const userId = session.user.id;
            const now = Date.now();
            const timeSinceLastLog = now - lastLoginLogTimeRef.current;
            
            // Only log if:
            // 1. This is a different user (new login), OR
            // 2. It's been more than 10 seconds since the last log for this user (prevents rapid duplicates)
            const isDifferentUser = userId !== lastLoggedUserIdRef.current;
            const isNewLogin = isDifferentUser || timeSinceLastLog > 10000;
            
            if (isNewLogin) {
              lastLoggedUserIdRef.current = userId;
              lastLoginLogTimeRef.current = now;
              
              trackEvent("user_logged_in", { method: "email" });
              // Log activity for login
              logActivityDirect({
                userId: session.user.id,
                actionType: "login",
                entityType: "user",
                entityId: session.user.id,
                description: `User logged in: ${session.user.email}`,
                metadata: { email: session.user.email },
              });
            }
          }
        } else if (event === "SIGNED_OUT") {
          lastLoggedUserIdRef.current = null;
          lastLoginLogTimeRef.current = 0;
          clearSentryUser();
          resetUser();
          trackEvent("user_logged_out");
          // Note: Can't log activity on signout as user context is gone
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
    // Log activity before signing out (while we still have user context)
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await logActivityDirect({
        userId: session.user.id,
        actionType: "logout",
        entityType: "user",
        entityId: session.user.id,
        description: `User logged out: ${session.user.email}`,
        metadata: { email: session.user.email },
      });
    }
    await supabase.auth.signOut();
  };

  return {
    user,
    session,
    loading,
    signOut,
  };
};