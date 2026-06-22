import { Suspense } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerOrg } from "@/hooks/usePartnerOrg";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  LogOut,
  Handshake,
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

interface PartnerLayoutProps {
  children: React.ReactNode;
}

const PARTNER_MENU_ITEMS = [
  { href: "/partner", menuKey: "dashboard", icon: LayoutDashboard },
  { href: "/partner/opportunities", menuKey: "opportunities", icon: FolderKanban },
  { href: "/partner/notifications", menuKey: "notifications", icon: Bell },
  { href: "/partner/settings", menuKey: "settings", icon: Settings },
] as const;

const PartnerLayout = ({ children }: PartnerLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: partnerOrg } = usePartnerOrg();
  const unreadCount = useUnreadNotificationCount();
  const { t } = useTranslation(["dashboard"]);

  const menuItems = PARTNER_MENU_ITEMS.map((item) => ({
    ...item,
    label: t(`partner.menu.${item.menuKey}`),
  }));

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getPageTitle = () => {
    if (location.pathname === "/partner") return t("partner.pages.dashboard");
    if (/^\/partner\/opportunities\/\d+$/.test(location.pathname)) {
      return t("partner.pages.opportunityDetails");
    }
    if (location.pathname.startsWith("/partner/opportunities")) return t("partner.pages.opportunities");
    if (location.pathname === "/partner/notifications") return t("partner.pages.notifications");
    if (location.pathname === "/partner/settings") return t("partner.pages.settings");
    return t("partner.pages.default");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarBrand subtitle={t("partner.portal")} />
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
                      (item.href !== "/partner" && location.pathname.startsWith(item.href));
                    const isNotifications = item.href === "/partner/notifications";
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
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
                    <span>{t("header.signOut")}</span>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton onClick={() => navigate("/auth")}>
                    <Handshake />
                    <span>{t("header.signIn")}</span>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>

          <SidebarRail />
        </Sidebar>

        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 lg:px-6">
            <SidebarTrigger className="-ml-1" />
            <div className="flex items-center gap-4 flex-1">
              <h2 className="text-lg font-semibold hidden lg:block">{getPageTitle()}</h2>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <LanguageSwitcher />
              <div className="flex items-center gap-2 min-w-0">
                {partnerOrg?.logo_url ? (
                  <img
                    src={partnerOrg.logo_url}
                    alt={partnerOrg.name}
                    className="w-8 h-8 rounded-md object-cover shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Handshake className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className="hidden sm:block min-w-0">
                  <span className="text-sm font-medium block truncate">
                    {partnerOrg?.name || user?.email || t("partner.roleFallback")}
                  </span>
                  {partnerOrg?.name && user?.email ? (
                    <span className="text-xs text-muted-foreground block truncate">{user.email}</span>
                  ) : null}
                </div>
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
      </div>
    </SidebarProvider>
  );
};

export default PartnerLayout;








