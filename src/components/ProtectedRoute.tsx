import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useMembership } from "@/hooks/useMembership";
import { isMembershipExemptRole } from "@/lib/membershipAccess";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean; // Require authentication by default
  requireMembership?: boolean; // Gate on active membership (default: true)
}

const ProtectedRoute = ({
  children,
  requireAuth = true,
  requireMembership = true,
}: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();

  // Only fetch profile/membership when we have a user
  const { data: profile, isPending: profilePending } = useProfile();
  const { hasCompletedOnboarding, loading: membershipLoading } = useMembership();

  // Allow bypassing auth only if explicitly set to false (for development)
  if (requireAuth === false) {
    return <>{children}</>;
  }

  // Only block on profile/membership queries when we actually gate on membership.
  // Membership-exempt routes (e.g. partner) skip this to avoid a second full-screen spinner.
  const isLoading =
    authLoading || (requireMembership && !!user && (profilePending || membershipLoading));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    // Redirect to auth page with return URL
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Membership gate — skip for exempt roles and when caller opts out
  if (requireMembership) {
    if (!isMembershipExemptRole(profile?.role) && !hasCompletedOnboarding) {
      // First-time setup only (any memberships row = onboarding done once)
      return <Navigate to="/onboarding" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;









