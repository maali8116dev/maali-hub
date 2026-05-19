import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useMembership } from "@/hooks/useMembership";

// Roles that do NOT need a membership to access their areas
const MEMBERSHIP_EXEMPT_ROLES = ["admin", "reviewer", "partner"] as const;

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
  const { membership, loading: membershipLoading } = useMembership();

  // Allow bypassing auth only if explicitly set to false (for development)
  if (requireAuth === false) {
    return <>{children}</>;
  }

  // Use isPending for profile (true whenever no data yet, regardless of fetch state)
  // membershipLoading already combines isLoading || isPending in useMembership
  const isLoading = authLoading || (!!user && (profilePending || membershipLoading));

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
    const role = profile?.role;
    const isExempt = role && MEMBERSHIP_EXEMPT_ROLES.includes(role as any);

    if (!isExempt && !membership) {
      // No active membership → send through onboarding
      return <Navigate to="/onboarding" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;









