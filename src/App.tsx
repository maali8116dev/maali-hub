import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CookieConsent } from "@/components/CookieConsent";
import { useCookieConsent } from "@/hooks/useCookieConsent";
import { initSentry } from "@/lib/sentry";
import { initPostHog } from "@/lib/posthog";
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
import AdminProjectDetails from "./pages/admin/ProjectDetails";
import AdminActivityLogs from "./pages/admin/ActivityLogs";
import AdminCategories from "./pages/admin/Categories";
import ReviewerLayout from "@/components/reviewer/ReviewerLayout";
import ReviewerDashboard from "./pages/reviewer/Dashboard";
import ReviewerApplications from "./pages/reviewer/Applications";
import ReviewerPending from "./pages/reviewer/Pending";
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

const queryClient = new QueryClient();

// Component to initialize tracking after consent
const TrackingInitializer = () => {
  const { canTrack } = useCookieConsent();

  useEffect(() => {
    if (canTrack) {
      initSentry();
      initPostHog();
    }
  }, [canTrack]);

  return null;
};

const App = () => (
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
          {/* Dashboard Routes - Protected, requires authentication */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requireAuth={true}>
                <DashboardLayout>
                  <Dashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/applications"
            element={
              <ProtectedRoute requireAuth={true}>
                <DashboardLayout>
                  <Applications />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/applications/:id"
            element={
              <ProtectedRoute requireAuth={true}>
                <DashboardLayout>
                  <ApplicationDetails />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/documents"
            element={
              <ProtectedRoute requireAuth={true}>
                <DashboardLayout>
                  <Documents />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/notifications"
            element={
              <ProtectedRoute requireAuth={true}>
                <DashboardLayout>
                  <Notifications />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/profile"
            element={
              <ProtectedRoute requireAuth={true}>
                <DashboardLayout>
                  <Profile />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/settings"
            element={
              <ProtectedRoute requireAuth={true}>
                <DashboardLayout>
                  <Settings />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/billing"
            element={
              <ProtectedRoute requireAuth={true}>
                <DashboardLayout>
                  <Billing />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          {/* Admin Routes - Protected, requires authentication */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/projects"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminProjects />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/projects/new"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminProjectForm />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/projects/:id"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminProjectDetails />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/projects/:id/edit"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminProjectForm />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminUsers />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/financial"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminFinancial />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/activity-logs"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminActivityLogs />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/categories"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminCategories />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminSettings />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/review-management"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <ReviewManagement />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/blog"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminBlog />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/blog/new"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminBlogForm />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/blog/:id/edit"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminBlogForm />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/faq"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminFAQ />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/faq/new"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminFAQForm />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/faq/:id/edit"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminFAQForm />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/mentors"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminMentors />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/mentors/new"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminMentorForm />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/mentors/:id/edit"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminMentorForm />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/resources"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminResources />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/resources/new"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminResourceForm />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/resources/:id"
            element={
              <ProtectedRoute requireAuth={true}>
                <AdminLayout>
                  <AdminResourceForm />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* Reviewer Routes - Protected, requires authentication */}
          <Route
            path="/reviewer"
            element={
              <ProtectedRoute requireAuth={true}>
                <ReviewerLayout>
                  <ReviewerDashboard />
                </ReviewerLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reviewer/applications"
            element={
              <ProtectedRoute requireAuth={true}>
                <ReviewerLayout>
                  <ReviewerApplications />
                </ReviewerLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reviewer/applications/:id"
            element={
              <ProtectedRoute requireAuth={true}>
                <ReviewerLayout>
                  <ReviewApplication />
                </ReviewerLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reviewer/pending"
            element={
              <ProtectedRoute requireAuth={true}>
                <ReviewerLayout>
                  <ReviewerPending />
                </ReviewerLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reviewer/settings"
            element={
              <ProtectedRoute requireAuth={true}>
                <ReviewerLayout>
                  <ReviewerSettings />
                </ReviewerLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reviewer/notifications"
            element={
              <ProtectedRoute requireAuth={true}>
                <ReviewerLayout>
                  <ReviewerNotifications />
                </ReviewerLayout>
              </ProtectedRoute>
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

export default App;
