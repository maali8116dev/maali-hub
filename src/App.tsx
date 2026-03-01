import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CookieConsent } from "@/components/CookieConsent";
import { MaintenanceMode } from "@/components/MaintenanceMode";
import { useCookieConsent } from "@/hooks/useCookieConsent";
import { initSentry } from "@/lib/sentry";
import { initPostHog } from "@/lib/posthog";
import { initRateLimitConfig } from "@/lib/rateLimits";
import { getMaintenanceConfig } from "@/lib/maintenanceMode";
import Index from "./pages/Index";
import Projects from "./pages/projects/Projects";
import About from "./pages/About";
import Resources from "./pages/Resources";
import Contact from "./pages/Contact";
import Auth from "./pages/Auth";
import ProjectDetails from "./pages/projects/ProjectDetails";
import ApplicationForm from "./pages/projects/ApplicationForm";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleBasedRoute from "@/components/RoleBasedRoute";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import AdminLayout from "@/components/admin/AdminLayout";
import Dashboard from "./pages/dashboard/Dashboard";
import Applications from "./pages/dashboard/Applications";
import ApplicationDetails from "./pages/dashboard/ApplicationDetails";
import Documents from "./pages/dashboard/Documents";
import Notifications from "./pages/dashboard/Notifications";
import Profile from "./pages/dashboard/Profile";
import Settings from "./pages/dashboard/Settings";
import Billing from "./pages/dashboard/Billing";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminProjects from "./pages/admin/Projects";
import AdminApplications from "./pages/admin/Applications";
import AdminUsers from "./pages/admin/Users";
import AdminUserDetails from "./pages/admin/UserDetails";
import AdminSettings from "./pages/admin/Settings";
import AdminFinancial from "./pages/admin/Financial";
import AdminBlog from "./pages/admin/Blog";
import AdminBlogForm from "./pages/admin/BlogForm";
import AdminFAQ from "./pages/admin/FAQ";
import AdminFAQForm from "./pages/admin/FAQForm";
import AdminMentors from "./pages/admin/Mentors";
import AdminMentorForm from "./pages/admin/MentorForm";
import AdminResources from "./pages/admin/Resources";
import AdminResourceForm from "./pages/admin/ResourceForm";
import AdminProjectForm from "./pages/admin/ProjectForm";
import ReviewManagement from "./pages/admin/ReviewManagement";
import { ReviewerDetails } from "./pages/admin/ReviewerDetails";
import AdminProjectDetails from "./pages/admin/ProjectDetails";
import ProjectApplications from "./pages/admin/ProjectApplications";
import AdminActivityLogs from "./pages/admin/ActivityLogs";
import AdminCategories from "./pages/admin/Categories";
import ReviewerLayout from "@/components/reviewer/ReviewerLayout";
import ReviewerDashboard from "./pages/reviewer/Dashboard";
import ReviewerApplications from "./pages/reviewer/Applications";
import ReviewApplication from "./pages/reviewer/ReviewApplication";
import ReviewerSettings from "./pages/reviewer/Settings";
import ReviewerNotifications from "./pages/reviewer/Notifications";
import Apply from "./pages/Apply";
import Partners from "./pages/Partners";
import SuccessStories from "./pages/SuccessStories";
import Blog from "./pages/Blog";
import BlogDetail from "./pages/BlogDetail";
import Help from "./pages/Help";
import FAQ from "./pages/FAQ";
import Mentors from "./pages/Mentors";
import Guide from "./pages/Guide";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Cookies from "./pages/Cookies";
import DataProtection from "./pages/DataProtection";
import ErrorTest from "./tests/ErrorTest";
import PaymentSuccess from "./pages/payment/PaymentSuccess";
import PaymentCancel from "./pages/payment/PaymentCancel";

const queryClient = new QueryClient();

// Component to initialize tracking after consent
const TrackingInitializer = () => {
  const { canTrack } = useCookieConsent();

  useEffect(() => {
    // Load rate limit config from DB on app startup (no consent needed)
    initRateLimitConfig();

    if (canTrack) {
      initSentry();
      initPostHog();
    }
  }, [canTrack]);

  return null;
};

const App = () => {
  const maintenanceConfig = getMaintenanceConfig();

  // Show maintenance mode if enabled
  if (maintenanceConfig.enabled) {
    return (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <MaintenanceMode
          message={maintenanceConfig.message}
          estimatedTime={maintenanceConfig.estimatedTime}
          contactEmail={maintenanceConfig.contactEmail}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <TooltipProvider>
            <TrackingInitializer />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <CookieConsent />
              <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/about" element={<About />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/projects/:id" element={<ProjectDetails />} />
          <Route path="/projects/:id/apply" element={<ApplicationForm />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/cancel" element={<PaymentCancel />} />
          
          {/* Footer Link Pages */}
          <Route path="/apply" element={<Apply />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/success-stories" element={<SuccessStories />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:id" element={<BlogDetail />} />
          <Route path="/help" element={<Help />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/mentors" element={<Mentors />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/cookies" element={<Cookies />} />
          <Route path="/data-protection" element={<DataProtection />} />
          <Route path="/tests/error" element={<ErrorTest />} />
          {/* Dashboard Routes - Protected, requires authentication, role-based redirect */}
          <Route
            path="/dashboard"
            element={
              <RoleBasedRoute>
              <ProtectedRoute requireAuth={true}>
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/dashboard/applications"
            element={
              <RoleBasedRoute>
              <ProtectedRoute requireAuth={true}>
                <DashboardLayout>
                  <Applications />
                </DashboardLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/dashboard/applications/:id"
            element={
              <RoleBasedRoute>
              <ProtectedRoute requireAuth={true}>
                <DashboardLayout>
                  <ApplicationDetails />
                </DashboardLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/dashboard/documents"
            element={
              <RoleBasedRoute>
              <ProtectedRoute requireAuth={true}>
                <DashboardLayout>
                  <Documents />
                </DashboardLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/dashboard/notifications"
            element={
              <RoleBasedRoute>
              <ProtectedRoute requireAuth={true}>
                <DashboardLayout>
                  <Notifications />
                </DashboardLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/dashboard/profile"
            element={
              <RoleBasedRoute>
              <ProtectedRoute requireAuth={true}>
                <DashboardLayout>
                  <Profile />
                </DashboardLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/dashboard/settings"
            element={
              <RoleBasedRoute>
              <ProtectedRoute requireAuth={true}>
                <DashboardLayout>
                  <Settings />
                </DashboardLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/dashboard/billing"
            element={
              <RoleBasedRoute>
              <ProtectedRoute requireAuth={true}>
                <DashboardLayout>
                  <Billing />
                </DashboardLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />

          {/* Admin Routes - Protected, requires authentication and admin role */}
          <Route
            path="/admin"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/projects"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminProjects />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/projects/new"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminProjectForm />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/projects/:id"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminProjectDetails />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/projects/:id/edit"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminProjectForm />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminUsers />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/users/:userId"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminUserDetails />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/applications"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminApplications />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/applications/:id"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <ApplicationDetails />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/projects/:id/applications"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <ProjectApplications />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/financial"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminFinancial />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/activity-logs"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminActivityLogs />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/categories"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminCategories />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminSettings />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/review-management"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <ReviewManagement />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/reviewers/:reviewerId"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <ReviewerDetails />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/blog"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminBlog />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/blog/new"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminBlogForm />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/blog/:id/edit"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminBlogForm />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/faq"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminFAQ />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/faq/new"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminFAQForm />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/faq/:id/edit"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminFAQForm />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/mentors"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminMentors />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/mentors/new"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminMentorForm />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/mentors/:id/edit"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminMentorForm />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/resources"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminResources />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/resources/new"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminResourceForm />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/resources/:id"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminResourceForm />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />

          {/* Reviewer Routes - Protected, requires authentication and reviewer role */}
          <Route
            path="/reviewer"
            element={
              <RoleBasedRoute allowedRoles={["reviewer", "admin"]}>
              <ProtectedRoute requireAuth={true}>
                <ReviewerLayout>
                  <ReviewerDashboard />
                </ReviewerLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/reviewer/applications"
            element={
              <RoleBasedRoute allowedRoles={["reviewer", "admin"]}>
              <ProtectedRoute requireAuth={true}>
                <ReviewerLayout>
                  <ReviewerApplications />
                </ReviewerLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/reviewer/applications/:id"
            element={
              <RoleBasedRoute allowedRoles={["reviewer", "admin"]}>
              <ProtectedRoute requireAuth={true}>
                <ReviewerLayout>
                  <ReviewApplication />
                </ReviewerLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/reviewer/settings"
            element={
              <RoleBasedRoute allowedRoles={["reviewer", "admin"]}>
              <ProtectedRoute requireAuth={true}>
                <ReviewerLayout>
                  <ReviewerSettings />
                </ReviewerLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/reviewer/notifications"
            element={
              <RoleBasedRoute allowedRoles={["reviewer", "admin"]}>
              <ProtectedRoute requireAuth={true}>
                <ReviewerLayout>
                  <ReviewerNotifications />
                </ReviewerLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ErrorBoundary>
    </QueryClientProvider>
  </ThemeProvider>
  );
};

export default App;
