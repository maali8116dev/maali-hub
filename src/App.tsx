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
import Application from "./pages/projects/Application";
import ApplicationForm from "./pages/projects/ApplicationForm";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import AdminLayout from "@/components/admin/AdminLayout";
import Dashboard from "./pages/dashboard/Dashboard";
import Applications from "./pages/dashboard/Applications";
import Notifications from "./pages/dashboard/Notifications";
import Profile from "./pages/dashboard/Profile";
import Settings from "./pages/dashboard/Settings";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminProjects from "./pages/admin/Projects";
import AdminApplications from "./pages/admin/Applications";
import AdminUsers from "./pages/admin/Users";
import AdminSettings from "./pages/admin/Settings";
import AdminBlog from "./pages/admin/Blog";
import AdminBlogForm from "./pages/admin/BlogForm";
import AdminProjectForm from "./pages/admin/ProjectForm";
import AdminProjectDetails from "./pages/admin/ProjectDetails";
import AdminActivityLogs from "./pages/admin/ActivityLogs";
import ReviewerLayout from "@/components/reviewer/ReviewerLayout";
import ReviewerDashboard from "./pages/reviewer/Dashboard";
import ReviewerApplications from "./pages/reviewer/Applications";
import ReviewerPending from "./pages/reviewer/Pending";
import ReviewApplication from "./pages/reviewer/ReviewApplication";
import ReviewerSettings from "./pages/reviewer/Settings";
import Apply from "./pages/Apply";
import Partners from "./pages/Partners";
import SuccessStories from "./pages/SuccessStories";
import Blog from "./pages/Blog";
import BlogDetail from "./pages/BlogDetail";
import Help from "./pages/Help";
import FAQ from "./pages/FAQ";
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
          <CookieConsent />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/about" element={<About />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/application/:projectId" element={<Application />} />
          <Route path="/application-form/:projectId?" element={<ApplicationForm />} />
          
          {/* Footer Link Pages */}
          <Route path="/apply" element={<Apply />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/success-stories" element={<SuccessStories />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:id" element={<BlogDetail />} />
          <Route path="/help" element={<Help />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/cookies" element={<Cookies />} />
          <Route path="/data-protection" element={<DataProtection />} />
          <Route path="/tests/error" element={<ErrorTest />} />
          {/* Dashboard Routes - Accessible without auth for development */}
          <Route
            path="/dashboard"
            element={
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            }
          />
          <Route
            path="/dashboard/applications"
            element={
              <DashboardLayout>
                <Applications />
              </DashboardLayout>
            }
          />
          <Route
            path="/dashboard/notifications"
            element={
              <DashboardLayout>
                <Notifications />
              </DashboardLayout>
            }
          />
          <Route
            path="/dashboard/profile"
            element={
              <DashboardLayout>
                <Profile />
              </DashboardLayout>
            }
          />
          <Route
            path="/dashboard/settings"
            element={
              <DashboardLayout>
                <Settings />
              </DashboardLayout>
            }
          />

          {/* Admin Routes - Accessible without auth for development */}
          <Route
            path="/admin"
            element={
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/projects"
            element={
              <AdminLayout>
                <AdminProjects />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/projects/new"
            element={
              <AdminLayout>
                <AdminProjectForm />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/projects/:id"
            element={
              <AdminLayout>
                <AdminProjectDetails />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/projects/:id/edit"
            element={
              <AdminLayout>
                <AdminProjectForm />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/applications"
            element={
              <AdminLayout>
                <AdminApplications />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminLayout>
                <AdminUsers />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/activity-logs"
            element={
              <AdminLayout>
                <AdminActivityLogs />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <AdminLayout>
                <AdminSettings />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/blog"
            element={
              <AdminLayout>
                <AdminBlog />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/blog/new"
            element={
              <AdminLayout>
                <AdminBlogForm />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/blog/:id/edit"
            element={
              <AdminLayout>
                <AdminBlogForm />
              </AdminLayout>
            }
          />

          {/* Reviewer Routes - Accessible without auth for development */}
          <Route
            path="/reviewer"
            element={
              <ReviewerLayout>
                <ReviewerDashboard />
              </ReviewerLayout>
            }
          />
          <Route
            path="/reviewer/applications"
            element={
              <ReviewerLayout>
                <ReviewerApplications />
              </ReviewerLayout>
            }
          />
          <Route
            path="/reviewer/applications/:id"
            element={
              <ReviewerLayout>
                <ReviewApplication />
              </ReviewerLayout>
            }
          />
          <Route
            path="/reviewer/pending"
            element={
              <ReviewerLayout>
                <ReviewerPending />
              </ReviewerLayout>
            }
          />
          <Route
            path="/reviewer/settings"
            element={
              <ReviewerLayout>
                <ReviewerSettings />
              </ReviewerLayout>
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
