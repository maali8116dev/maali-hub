import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CookieConsent } from "@/components/CookieConsent";
import { MaintenanceMode } from "@/components/MaintenanceMode";
import { SiteGate } from "@/components/SiteGate";
import { useCookieConsent } from "@/hooks/useCookieConsent";
import { initSentry } from "@/lib/sentry";
import { initPostHog } from "@/lib/posthog";
import { initRateLimitConfig } from "@/lib/rateLimits";
import { getMaintenanceConfig } from "@/lib/maintenanceMode";
import { RouteSEO } from "@/components/seo/RouteSEO";
import PageFallback from "@/components/PageFallback";

function RedirectProjectToOpportunity() {
  const { id } = useParams();
  return <Navigate to={`/opportunities/${id}`} replace />;
}

// Critical path - eagerly loaded
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleBasedRoute from "@/components/RoleBasedRoute";
// Partner shell is eager so its sidebar chrome renders immediately on reload
// instead of flashing the public-site PageFallback skeleton.
import PartnerLayout from "@/components/partner/PartnerLayout";

// Lazy-loaded public pages
const Opportunities = lazy(() => import("./pages/projects/Opportunities"));
const About = lazy(() => import("./pages/About"));
const Resources = lazy(() => import("./pages/Resources"));
const Contact = lazy(() => import("./pages/Contact"));
const Auth = lazy(() => import("./pages/Auth"));
const ProjectDetails = lazy(() => import("./pages/projects/ProjectDetails"));
const ApplicationForm = lazy(() => import("./pages/projects/ApplicationForm"));
const Apply = lazy(() => import("./pages/Apply"));
const Partners = lazy(() => import("./pages/Partners"));
const SuccessStories = lazy(() => import("./pages/SuccessStories"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogDetail = lazy(() => import("./pages/BlogDetail"));
const Help = lazy(() => import("./pages/Help"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Mentors = lazy(() => import("./pages/Mentors"));
const Guide = lazy(() => import("./pages/Guide"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Cookies = lazy(() => import("./pages/Cookies"));
const DataProtection = lazy(() => import("./pages/DataProtection"));
const OAuthCallback = lazy(() => import("./pages/OAuthCallback"));
const Join = lazy(() => import("./pages/Join"));
const Onboarding = lazy(() => import("./pages/Onboarding"));

// Lazy-loaded dashboard pages
const DashboardLayout = lazy(() => import("@/components/dashboard/DashboardLayout"));
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const Applications = lazy(() => import("./pages/dashboard/Applications"));
const ApplicationDetails = lazy(() => import("./pages/dashboard/ApplicationDetails"));
const Documents = lazy(() => import("./pages/dashboard/Documents"));
const Notifications = lazy(() => import("./pages/dashboard/Notifications"));
const Profile = lazy(() => import("./pages/dashboard/Profile"));
const Settings = lazy(() => import("./pages/dashboard/Settings"));
const Billing = lazy(() => import("./pages/dashboard/Billing"));

// Lazy-loaded admin pages
const AdminLayout = lazy(() => import("@/components/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminProjects = lazy(() => import("./pages/admin/Projects"));
const AdminApplications = lazy(() => import("./pages/admin/Applications"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminUserDetails = lazy(() => import("./pages/admin/UserDetails"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminFinancial = lazy(() => import("./pages/admin/Financial"));
const AdminBlog = lazy(() => import("./pages/admin/Blog"));
const AdminBlogForm = lazy(() => import("./pages/admin/BlogForm"));
const AdminFAQ = lazy(() => import("./pages/admin/FAQ"));
const AdminFAQForm = lazy(() => import("./pages/admin/FAQForm"));
const AdminMentors = lazy(() => import("./pages/admin/Mentors"));
const AdminMentorForm = lazy(() => import("./pages/admin/MentorForm"));
const AdminResources = lazy(() => import("./pages/admin/Resources"));
const AdminPartners = lazy(() => import("./pages/admin/Partners"));
const AdminPartnerForm = lazy(() => import("./pages/admin/PartnerForm"));
const AdminSuccessStories = lazy(() => import("./pages/admin/SuccessStories"));
const AdminSuccessStoryForm = lazy(() => import("./pages/admin/SuccessStoryForm"));
const AdminResourceForm = lazy(() => import("./pages/admin/ResourceForm"));
const AdminProjectForm = lazy(() => import("./pages/admin/ProjectForm"));
const ReviewManagement = lazy(() => import("./pages/admin/ReviewManagement"));
const ReviewerDetails = lazy(() => import("./pages/admin/ReviewerDetails").then(m => ({ default: m.ReviewerDetails })));
const AdminProjectDetails = lazy(() => import("./pages/admin/ProjectDetails"));
const ProjectApplications = lazy(() => import("./pages/admin/ProjectApplications"));
const AdminActivityLogs = lazy(() => import("./pages/admin/ActivityLogs"));
const AdminSectors = lazy(() => import("./pages/admin/Categories"));
const AdminKyc = lazy(() => import("./pages/admin/Kyc"));
const AdminNotifications = lazy(() => import("./pages/admin/Notifications"));
const AdminInbound = lazy(() => import("./pages/admin/Inbound"));

// Lazy-loaded reviewer pages
const ReviewerLayout = lazy(() => import("@/components/reviewer/ReviewerLayout"));
const ReviewerDashboard = lazy(() => import("./pages/reviewer/Dashboard"));
const ReviewerApplications = lazy(() => import("./pages/reviewer/Applications"));
const ReviewApplication = lazy(() => import("./pages/reviewer/ReviewApplication"));
const ReviewerSettings = lazy(() => import("./pages/reviewer/Settings"));
const ReviewerNotifications = lazy(() => import("./pages/reviewer/Notifications"));

// Lazy-loaded partner pages
const PartnerDashboard = lazy(() => import("./pages/partner/Dashboard"));
const PartnerOpportunities = lazy(() => import("./pages/partner/Opportunities"));
const PartnerOpportunityForm = lazy(() => import("./pages/partner/OpportunityForm"));
const PartnerOpportunityDetails = lazy(() => import("./pages/partner/OpportunityDetails"));
const PartnerOpportunityApplications = lazy(() => import("./pages/partner/OpportunityApplications"));
const PartnerSettings = lazy(() => import("./pages/partner/Settings"));
const PartnerTeam = lazy(() => import("./pages/partner/Team"));
const PartnerNotifications = lazy(() => import("./pages/partner/Notifications"));

// Test page
const ErrorTest = lazy(() => import("./tests/ErrorTest"));

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
              <RouteSEO />
              <Suspense fallback={<PageFallback />}>
              <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/projects" element={<Navigate to="/opportunities" replace />} />
          <Route path="/projects/:id" element={<RedirectProjectToOpportunity />} />
          <Route path="/about" element={<About />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />
          {/* Onboarding — authenticated but membership gate bypassed (they're completing it here) */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute requireAuth={true} requireMembership={false}>
                <Onboarding />
              </ProtectedRoute>
            }
          />
          {/* Legacy join route — redirect to unified onboarding */}
          <Route path="/join" element={<Navigate to="/onboarding" replace />} />
          <Route path="/opportunities/:id" element={<ProjectDetails />} />
          <Route path="/opportunities/:id/apply" element={<ApplicationForm />} />
          <Route path="/payment/success" element={<Navigate to="/onboarding?awaiting=1" replace />} />
          <Route path="/payment/cancel" element={<Navigate to="/onboarding" replace />} />
          <Route path="/payment/test" element={<Navigate to="/onboarding" replace />} />
          
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
          {/* Dashboard Routes - nested to keep layout mounted */}
          <Route
            path="/dashboard"
            element={
              <RoleBasedRoute>
                <ProtectedRoute requireAuth={true}>
                  <DashboardLayout />
                </ProtectedRoute>
              </RoleBasedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="applications" element={<Applications />} />
            <Route path="applications/:id" element={<ApplicationDetails />} />
            <Route path="documents" element={<Documents />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="billing" element={<Billing />} />
          </Route>

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
            path="/admin/opportunities"
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
            path="/admin/opportunities/new"
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
            path="/admin/opportunities/:id"
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
            path="/admin/opportunities/:id/edit"
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
            path="/admin/opportunities/:id/applications"
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
            path="/admin/kyc"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminKyc />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/notifications"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminNotifications />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/inbound"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminInbound />
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
            path="/admin/sectors"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminSectors />
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
            path="/admin/partners"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminPartners />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/partners/new"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminPartnerForm />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/partners/:id/edit"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminPartnerForm />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/success-stories"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminSuccessStories />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/success-stories/new"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminSuccessStoryForm />
                </AdminLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/admin/success-stories/:id/edit"
            element={
              <RoleBasedRoute allowedRoles={["admin"]}>
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminSuccessStoryForm />
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

          {/* Partner Routes - Protected, requires authentication and partner role */}
          <Route path="/partner/dashboard" element={<Navigate to="/partner" replace />} />
          <Route
            path="/partner"
            element={
              <RoleBasedRoute allowedRoles={["partner", "admin"]}>
              <ProtectedRoute requireAuth={true} requireMembership={false}>
                <PartnerLayout>
                  <PartnerDashboard />
                </PartnerLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/partner/opportunities"
            element={
              <RoleBasedRoute allowedRoles={["partner", "admin"]}>
              <ProtectedRoute requireAuth={true} requireMembership={false}>
                <PartnerLayout>
                  <PartnerOpportunities />
                </PartnerLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/partner/opportunities/new"
            element={
              <RoleBasedRoute allowedRoles={["partner", "admin"]}>
              <ProtectedRoute requireAuth={true} requireMembership={false}>
                <PartnerLayout>
                  <PartnerOpportunityForm />
                </PartnerLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/partner/opportunities/:id/edit"
            element={
              <RoleBasedRoute allowedRoles={["partner", "admin"]}>
              <ProtectedRoute requireAuth={true} requireMembership={false}>
                <PartnerLayout>
                  <PartnerOpportunityForm />
                </PartnerLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/partner/opportunities/:id/applications"
            element={
              <RoleBasedRoute allowedRoles={["partner", "admin"]}>
              <ProtectedRoute requireAuth={true} requireMembership={false}>
                <PartnerLayout>
                  <PartnerOpportunityApplications />
                </PartnerLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/partner/opportunities/:id"
            element={
              <RoleBasedRoute allowedRoles={["partner", "admin"]}>
              <ProtectedRoute requireAuth={true} requireMembership={false}>
                <PartnerLayout>
                  <PartnerOpportunityDetails />
                </PartnerLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/partner/team"
            element={
              <RoleBasedRoute allowedRoles={["partner", "admin"]}>
              <ProtectedRoute requireAuth={true} requireMembership={false}>
                <PartnerLayout>
                  <PartnerTeam />
                </PartnerLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/partner/settings"
            element={
              <RoleBasedRoute allowedRoles={["partner", "admin"]}>
              <ProtectedRoute requireAuth={true} requireMembership={false}>
                <PartnerLayout>
                  <PartnerSettings />
                </PartnerLayout>
              </ProtectedRoute>
              </RoleBasedRoute>
            }
          />
          <Route
            path="/partner/notifications"
            element={
              <RoleBasedRoute allowedRoles={["partner", "admin"]}>
              <ProtectedRoute requireAuth={true} requireMembership={false}>
                <PartnerLayout>
                  <PartnerNotifications />
                </PartnerLayout>
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
              </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ErrorBoundary>
    </QueryClientProvider>
  </ThemeProvider>
  );
};

export default App;







