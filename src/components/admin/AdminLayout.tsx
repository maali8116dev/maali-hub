import { Suspense } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Users,
  Settings,
  LogOut,
  Shield,
  BookOpen,
  Activity,
  HelpCircle,
  FolderOpen,
  DollarSign,
  ClipboardCheck,
  Tag,
  Handshake,
  Star,
  Building2,
  UserCheck,
  Home,
  Bell,
  Inbox,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { SidebarBrand } from "@/components/ui/sidebar-brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useTranslation } from "react-i18next";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const ADMIN_MENU_ITEMS = [
  { href: "/admin", menuKey: "dashboard", icon: LayoutDashboard },
  { href: "/admin/opportunities", menuKey: "opportunities", icon: Briefcase },
  { href: "/admin/applications", menuKey: "applications", icon: FileText },
  { href: "/admin/notifications", menuKey: "notifications", icon: Bell },
  { href: "/admin/inbound", menuKey: "inbound", icon: Inbox },
  { href: "/admin/kyc", menuKey: "kyc", icon: Shield },
  { href: "/admin/review-management", menuKey: "reviewManagement", icon: ClipboardCheck },
  { href: "/admin/financial", menuKey: "financial", icon: DollarSign },
  { href: "/admin/sectors", menuKey: "sectors", icon: Tag },
  { href: "/admin/resources", menuKey: "resources", icon: FolderOpen },
  { href: "/admin/blog", menuKey: "blog", icon: BookOpen },
  { href: "/admin/partners", menuKey: "partners", icon: Handshake },
  { href: "/admin/success-stories", menuKey: "successStories", icon: Star },
  { href: "/admin/faq", menuKey: "faq", icon: HelpCircle },
  { href: "/admin/mentors", menuKey: "mentors", icon: Users },
  { href: "/admin/users", menuKey: "users", icon: Users },
  { href: "/admin/activity-logs", menuKey: "activityLogs", icon: Activity },
  { href: "/admin/settings", menuKey: "settings", icon: Settings },
] as const;

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { t } = useTranslation(["dashboard"]);

  const menuItems = ADMIN_MENU_ITEMS.map((item) => ({
    ...item,
    label: t(`admin.menu.${item.menuKey}`),
  }));

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getPageTitle = () => {
    if (location.pathname === "/admin") return t("admin.pages.dashboard");
    if (location.pathname === "/admin/opportunities") return t("admin.pages.opportunities");
    if (location.pathname.startsWith("/admin/opportunities/") && location.pathname.endsWith("/applications")) {
      return t("admin.pages.opportunityApplications");
    }
    if (location.pathname === "/admin/applications") return t("admin.pages.applications");
    if (location.pathname === "/admin/financial") return t("admin.pages.financial");
    if (location.pathname === "/admin/kyc") return t("admin.pages.kyc");
    if (location.pathname === "/admin/notifications") return t("admin.pages.notifications");
    if (location.pathname.startsWith("/admin/blog")) return t("admin.pages.blog");
    if (location.pathname.startsWith("/admin/partners")) return t("admin.pages.partners");
    if (location.pathname.startsWith("/admin/success-stories")) return t("admin.pages.successStories");
    if (location.pathname.startsWith("/admin/faq")) return t("admin.pages.faq");
    if (location.pathname.startsWith("/admin/mentors")) return t("admin.pages.mentors");
    if (location.pathname === "/admin/users") return t("admin.pages.users");
    if (location.pathname.startsWith("/admin/users/")) return t("admin.pages.userDetails");
    if (location.pathname === "/admin/opportunities/new") return t("admin.pages.opportunityCreate");
    if (location.pathname.match(/\/admin\/opportunities\/\d+\/edit$/)) return t("admin.pages.opportunityEdit");
    if (location.pathname.match(/\/admin\/opportunities\/\d+$/) && !location.pathname.endsWith("/applications")) {
      return t("admin.pages.opportunityDetails");
    }
    if (location.pathname.startsWith("/admin/applications/") && location.pathname !== "/admin/applications") {
      return t("admin.pages.applicationDetails");
    }
    if (location.pathname.startsWith("/admin/reviewers/")) return t("admin.pages.reviewerDetails");
    if (location.pathname.match(/\/admin\/resources\/\d+$/)) return t("admin.pages.resourceEdit");
    if (location.pathname === "/admin/sectors") return t("admin.pages.sectors");
    if (location.pathname === "/admin/activity-logs") return t("admin.pages.activityLogs");
    if (location.pathname === "/admin/settings") return t("admin.pages.settings");
    if (location.pathname.startsWith("/admin/inbound")) return t("admin.pages.inbound");
    if (location.pathname.startsWith("/admin/resources")) return t("admin.pages.resources");
    if (location.pathname.startsWith("/admin/review-management")) return t("admin.pages.reviewManagement");
    return t("admin.pages.dashboard");
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarBrand subtitle={t("admin.panel")} />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href || 
                    (item.href === "/admin/blog" && location.pathname.startsWith("/admin/blog")) ||
                    (item.href === "/admin/partners" && location.pathname.startsWith("/admin/partners")) ||
                    (item.href === "/admin/success-stories" && location.pathname.startsWith("/admin/success-stories")) ||
                    (item.href === "/admin/faq" && location.pathname.startsWith("/admin/faq")) ||
                    (item.href === "/admin/mentors" && location.pathname.startsWith("/admin/mentors")) ||
                    (item.href === "/admin/resources" && location.pathname.startsWith("/admin/resources")) ||
                    (item.href === "/admin/sectors" && location.pathname.startsWith("/admin/sectors")) ||
                    (item.href === "/admin/inbound" && location.pathname.startsWith("/admin/inbound"));
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                      >
                        <Link to={item.href}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            {/* Testing Dashboards - Admin access to all dashboards */}
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={() => navigate("/dashboard")}
                tooltip={t("admin.footer.userDashboard")}
              >
                <Home />
                <span>{t("admin.footer.userDashboard")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={() => navigate("/partner")}
                tooltip={t("admin.footer.partnerDashboard")}
              >
                <Building2 />
                <span>{t("admin.footer.partnerDashboard")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={() => navigate("/reviewer")}
                tooltip={t("admin.footer.reviewerDashboard")}
              >
                <UserCheck />
                <span>{t("admin.footer.reviewerDashboard")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              {user ? (
                <SidebarMenuButton onClick={handleSignOut}>
                  <LogOut />
                  <span>{t("header.signOut")}</span>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton onClick={() => navigate("/auth")}>
                  <Shield />
                  <span>{t("header.signIn")}</span>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        {/* Mobile Header */}
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4 lg:hidden">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
            <div className="flex shrink-0 items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <span className="hidden max-w-[140px] truncate text-sm font-medium sm:inline">
                {user?.email || t("admin.roleFallback")}
              </span>
            </div>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="sticky top-0 z-10 hidden h-16 shrink-0 items-center gap-2 border-b bg-background px-6 lg:flex">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <h2 className="truncate text-lg font-semibold">{getPageTitle()}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <ThemeToggle />
            <LanguageSwitcher />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium">
                {user?.email || t("admin.roleFallback")}
              </span>
            </div>
          </div>
        </header>

        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-x-auto p-4 lg:p-6">
          <Suspense
            fallback={
              <div className="flex min-h-[240px] items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            }
          >
            {children}
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AdminLayout;









