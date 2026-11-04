import { supabase } from "@/integrations/supabase/client";
import { isMembershipExemptRole, userNeedsOnboarding } from "@/lib/membershipAccess";

/** Resolves where a freshly authenticated user should land, based on role/onboarding. */
export async function getPostAuthPath(fallbackPath: string): Promise<string> {
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
