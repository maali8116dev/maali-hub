import { ReactNode, useEffect, useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useQueryClient } from "@tanstack/react-query";

interface RoleBasedRouteProps {
  children: ReactNode;
  allowedRoles?: ("admin" | "reviewer" | "applicant" | "partner")[];
  redirectTo?: string;
}

/**
 * Gets the default dashboard path for a given role.
 */
const getDashboardForRole = (role: string): string => {
  switch (role) {
    case "admin": return "/admin";
    case "reviewer": return "/reviewer";
    case "partner": return "/partner";
    default: return "/dashboard";
  }
};

/**
 * RoleBasedRoute component that:
 * 1. Checks if user is authenticated
 * 2. Fetches user profile to get role
 * 3. Redirects to appropriate dashboard based on role
 * 4. Blocks access if role doesn't match allowedRoles
 */
const RoleBasedRoute = ({ 
  children, 
  allowedRoles,
  redirectTo 
}: RoleBasedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { data: userRole, isLoading: roleLoading } = useUserRole();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Invalidate role cache periodically to catch role changes
  // This ensures role changes in the database are reflected within 2 minutes
  // NOTE: All hooks must be called before any conditional returns (Rules of Hooks)
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["user-role", user.id] });
    }, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.id, queryClient]);

  // Compute the redirect target (if any) based on role and current path
  const redirectTarget = useMemo(() => {
    if (authLoading || roleLoading) return null; // Still loading, wait
    if (!user) return "/auth";
    
    // If role is null (profile doesn't exist), default to applicant
    // This allows new users to access /dashboard while their profile is being created
    const role = userRole || "applicant";
    const { pathname } = location;

    // Applicant dashboard routes — redirect non-applicants to their own dashboard
    if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
      if (role === "reviewer") {
        return pathname === "/dashboard"
          ? "/reviewer"
          : pathname.replace("/dashboard", "/reviewer");
      }
      if (role === "admin") {
        return pathname === "/dashboard"
          ? "/admin"
          : pathname.replace("/dashboard", "/admin");
      }
      if (role === "partner") {
        return pathname === "/dashboard"
          ? "/partner"
          : pathname.replace("/dashboard", "/partner");
      }
    }

    // Partner routes — only partners and admins allowed
    if (pathname.startsWith("/partner")) {
      if (role !== "partner" && role !== "admin") {
        return getDashboardForRole(role);
      }
    }

    // Reviewer routes — only reviewers and admins allowed
    if (pathname.startsWith("/reviewer")) {
      if (role !== "reviewer" && role !== "admin") {
        return getDashboardForRole(role);
      }
    }

    // Admin routes — only admins allowed
    if (pathname.startsWith("/admin")) {
      if (role !== "admin") {
        return getDashboardForRole(role);
      }
    }

    // Explicit allowedRoles check (safety net)
    if (allowedRoles && !allowedRoles.includes(role)) {
      return redirectTo || getDashboardForRole(role);
    }

    return null; // No redirect needed
  }, [authLoading, roleLoading, user, userRole, location, allowedRoles, redirectTo]);

  // Show loading while checking auth and role
  if (authLoading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Redirect based on role logic
  if (redirectTarget && redirectTarget !== "/auth") {
    return <Navigate to={redirectTarget} replace />;
  }

  return <>{children}</>;
};

export default RoleBasedRoute;

