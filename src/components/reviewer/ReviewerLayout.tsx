import { Suspense, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  FileText,
  CheckCircle,
  XCircle,
  Settings,
  LogOut,
  ClipboardCheck,
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
import { SidebarBrand } from "@/components/ui/sidebar-brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useTranslation } from "react-i18next";

interface ReviewerLayoutProps {
  children: React.ReactNode;
}

const REVIEWER_MENU_ITEMS = [
  { href: "/reviewer", menuKey: "dashboard", icon: LayoutDashboard },
  { href: "/reviewer/applications", menuKey: "applications", icon: FileText },
  { href: "/reviewer/notifications", menuKey: "notifications", icon: Bell },
  { href: "/reviewer/settings", menuKey: "settings", icon: Settings },
] as const;

const ReviewerLayout = ({ children }: ReviewerLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const unreadCount = useUnreadNotificationCount();
  const { t } = useTranslation(["dashboard"]);

  const menuItems = REVIEWER_MENU_ITEMS.map((item) => ({
    ...item,
    label: t(`reviewer.menu.${item.menuKey}`),
  }));

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getPageTitle = () => {
    if (location.pathname === "/reviewer") return t("reviewer.pages.dashboard");
    if (location.pathname === "/reviewer/applications") return t("reviewer.pages.applications");
    if (location.pathname === "/reviewer/notifications") return t("reviewer.pages.notifications");
    if (location.pathname === "/reviewer/settings") return t("reviewer.pages.settings");
    return t("reviewer.pages.dashboard");
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarBrand subtitle={t("reviewer.panel")} />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  const isNotifications = item.href === "/reviewer/notifications";
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
                              {unreadCount > 99 ? '99+' : unreadCount}
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
                  <span>{t("header.signOut")}</span>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton onClick={() => navigate("/auth")}>
                  <ClipboardCheck />
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
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 lg:hidden">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2 flex-1 justify-end">
            <ThemeToggle />
            <LanguageSwitcher />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <ClipboardCheck className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium">
                {user?.email || t("reviewer.roleFallback")}
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
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <ClipboardCheck className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium">
                {user?.email || t("reviewer.roleFallback")}
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

export default ReviewerLayout;









