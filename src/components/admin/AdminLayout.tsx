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
import { ThemeToggle } from "@/components/ThemeToggle";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const menuItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/opportunities", label: "Opportunities", icon: Briefcase },
    { href: "/admin/applications", label: "Applications", icon: FileText },
    { href: "/admin/notifications", label: "Notifications", icon: Bell },
    { href: "/admin/kyc", label: "KYC Requests", icon: Shield },
    { href: "/admin/review-management", label: "Review Management", icon: ClipboardCheck },
    { href: "/admin/financial", label: "Financial", icon: DollarSign },
    { href: "/admin/sectors", label: "Sectors", icon: Tag },
    { href: "/admin/resources", label: "Resources", icon: FolderOpen },
    { href: "/admin/blog", label: "Blog", icon: BookOpen },
    { href: "/admin/partners", label: "Partners", icon: Handshake },
    { href: "/admin/success-stories", label: "Success Stories", icon: Star },
    { href: "/admin/faq", label: "FAQs", icon: HelpCircle },
    { href: "/admin/mentors", label: "Mentors", icon: Users },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/activity-logs", label: "Activity Logs", icon: Activity },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getPageTitle = () => {
    if (location.pathname === "/admin") return "Admin Dashboard";
    if (location.pathname === "/admin/opportunities") return "Manage Opportunities";
    if (location.pathname.startsWith("/admin/opportunities/") && location.pathname.endsWith("/applications")) {
      return "Opportunity Applications";
    }
    if (location.pathname === "/admin/applications") return "Review Applications";
    if (location.pathname === "/admin/financial") return "Financial Management";
    if (location.pathname === "/admin/kyc") return "KYC Requests";
    if (location.pathname === "/admin/notifications") return "Notifications";
    if (location.pathname.startsWith("/admin/blog")) return "Manage Blog";
    if (location.pathname.startsWith("/admin/partners")) return "Manage Partners";
    if (location.pathname.startsWith("/admin/success-stories")) return "Manage Success Stories";
    if (location.pathname.startsWith("/admin/faq")) return "Manage FAQs";
    if (location.pathname.startsWith("/admin/mentors")) return "Manage Mentors";
    if (location.pathname === "/admin/users") return "Manage Users";
    if (location.pathname === "/admin/sectors") return "Manage sectors";
    if (location.pathname === "/admin/activity-logs") return "Activity Logs";
    if (location.pathname === "/admin/settings") return "Admin Settings";
    return "Admin Dashboard";
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="lg">
                <Link to="/">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Maali</span>
                    <span className="truncate text-xs text-muted-foreground">
                      Admin Panel
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
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
                    (item.href === "/admin/sectors" && location.pathname.startsWith("/admin/sectors"));
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
                tooltip="User Dashboard"
              >
                <Home />
                <span>User Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={() => navigate("/partner")}
                tooltip="Partner Dashboard"
              >
                <Building2 />
                <span>Partner Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={() => navigate("/reviewer")}
                tooltip="Reviewer Dashboard"
              >
                <UserCheck />
                <span>Reviewer Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              {user ? (
                <SidebarMenuButton onClick={handleSignOut}>
                  <LogOut />
                  <span>Sign Out</span>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton onClick={() => navigate("/auth")}>
                  <Shield />
                  <span>Sign In</span>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        {/* Mobile Header */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 lg:hidden">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2 flex-1 justify-end">
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium">
                {user?.email || "Admin"}
              </span>
            </div>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex h-16 shrink-0 items-center gap-2 border-b px-6">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-4 flex-1">
            <h2 className="text-lg font-semibold">{getPageTitle()}</h2>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium">
                {user?.email || "Admin"}
              </span>
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
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









