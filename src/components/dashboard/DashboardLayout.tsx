import { Suspense } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useNotifications, useUnreadNotificationCount, useMarkNotificationAsRead, useMarkAllNotificationsAsRead } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  User,
  Settings,
  LogOut,
  Bell,
  CreditCard,
} from "lucide-react";
import NotificationsDropdown from "./NotificationsDropdown";
import EmailVerificationBanner from "./EmailVerificationBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useTranslation } from "react-i18next";
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

interface DashboardLayoutProps {
  children?: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: profile, isLoading: isLoadingProfile } = useProfile();
  const { t } = useTranslation(['dashboard', 'common']);

  // Get display name: profile name > email
  // User must be authenticated to access dashboard (enforced by ProtectedRoute)
  const displayName = profile?.firstName && profile?.lastName
    ? `${profile.firstName} ${profile.lastName}`
    : user?.email || "User";

  const menuItems = [
    { href: "/dashboard", label: t('dashboard:menu.dashboard'), icon: LayoutDashboard },
    { href: "/dashboard/applications", label: t('dashboard:menu.applications'), icon: FileText },
    { href: "/dashboard/documents", label: t('dashboard:menu.documents'), icon: FolderOpen },
    { href: "/dashboard/notifications", label: t('dashboard:menu.notifications'), icon: Bell },
    { href: "/dashboard/profile", label: t('dashboard:menu.profile'), icon: User },
    { href: "/dashboard/billing", label: t('dashboard:menu.billing'), icon: CreditCard },
    { href: "/dashboard/settings", label: t('dashboard:menu.settings'), icon: Settings },
  ];

  // Fetch real notifications
  const { data: notifications = [], isLoading: notificationsLoading } = useNotifications();
  const unreadCount = useUnreadNotificationCount();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  const handleMarkAsRead = (id: string) => {
    markAsRead.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getPageTitle = () => {
    if (location.pathname === "/dashboard") return t('dashboard:pages.dashboard');
    if (location.pathname === "/dashboard/applications") return t('dashboard:pages.applications');
    if (location.pathname === "/dashboard/documents") return t('dashboard:pages.documents');
    if (location.pathname === "/dashboard/notifications") return t('dashboard:pages.notifications');
    if (location.pathname === "/dashboard/profile") return t('dashboard:pages.profile');
    if (location.pathname === "/dashboard/billing") return t('dashboard:pages.billing');
    if (location.pathname === "/dashboard/settings") return t('dashboard:pages.settings');
    return t('dashboard:pages.dashboard');
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
                    <span className="text-lg font-bold">M</span>
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Maali</span>
                    <span className="truncate text-xs text-muted-foreground">
                      Opportunity Hub
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
                  const isActive =
                    location.pathname === item.href ||
                    (item.href === "/dashboard/applications" &&
                      location.pathname.startsWith("/dashboard/applications"));
                  const isNotifications = item.href === "/dashboard/notifications";

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                      >
                        <Link to={item.href} className="relative">
                          <Icon />
                          <span>{item.label}</span>
                          {isNotifications && unreadCount > 0 && (
                            <Badge
                              variant="destructive"
                              className="ml-auto h-5 min-w-5 px-1.5 flex items-center justify-center text-xs"
                            >
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </Badge>
                          )}
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
            <SidebarMenuItem>
              {user ? (
                <SidebarMenuButton onClick={handleSignOut}>
                  <LogOut />
                  <span>{t('dashboard:header.signOut')}</span>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton onClick={() => navigate("/auth")}>
                  <User />
                  <span>{t('dashboard:header.signIn')}</span>
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
            <LanguageSwitcher />
            <NotificationsDropdown
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={handleMarkAsRead}
              onMarkAllAsRead={handleMarkAllAsRead}
            />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium">
                {displayName}
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
            <LanguageSwitcher />
            <NotificationsDropdown
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={handleMarkAsRead}
              onMarkAllAsRead={handleMarkAllAsRead}
            />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium">
                {displayName}
              </span>
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
          {/* Email Verification Banner */}
          {user && !user.email_confirmed_at && user.email && (
            <EmailVerificationBanner email={user.email} />
          )}
          <Suspense
            fallback={
              <div className="flex min-h-[240px] items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            }
          >
            {children ?? <Outlet />}
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default DashboardLayout;








