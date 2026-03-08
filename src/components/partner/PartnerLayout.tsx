import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  LogOut,
  Handshake,
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

interface PartnerLayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  { href: "/partner", label: "Dashboard", icon: LayoutDashboard },
  { href: "/partner/projects", label: "My Projects", icon: FolderKanban },
  { href: "/partner/settings", label: "Settings", icon: Settings },
];

const PartnerLayout = ({ children }: PartnerLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getPageTitle = () => {
    if (location.pathname === "/partner") return "Partner Dashboard";
    if (location.pathname.startsWith("/partner/projects")) return "My Projects";
    if (location.pathname === "/partner/settings") return "Settings";
    return "Partner Portal";
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild size="lg">
                  <Link to="/">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Handshake className="h-5 w-5" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">Maali</span>
                      <span className="truncate text-xs text-muted-foreground">Partner Portal</span>
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
                      (item.href !== "/partner" && location.pathname.startsWith(item.href));
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
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
              <SidebarMenuItem>
                {user ? (
                  <SidebarMenuButton onClick={handleSignOut}>
                    <LogOut />
                    <span>Sign Out</span>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton onClick={() => navigate("/auth")}>
                    <Handshake />
                    <span>Sign In</span>
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
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Handshake className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium hidden sm:inline">
                  {user?.email || "Partner"}
                </span>
              </div>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
            {children}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default PartnerLayout;
