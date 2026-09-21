import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Shield, Database, Bell, CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type AdminPrefs = {
  emailNotifications: boolean;
  applicationAlerts: boolean;
  maintenanceMode: boolean;
};

const AdminSettings = () => {
  const { t } = useTranslation(["dashboard"]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading, isError: statsError, isSuccess: statsOk } = useAdminStats();

  const { data: prefs, isLoading: prefsLoading } = useQuery({
    queryKey: ["platform-settings", "admin-prefs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("id, maintenance_mode, email_notifications, application_alerts")
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const [settings, setSettings] = useState<AdminPrefs>({
    emailNotifications: true,
    applicationAlerts: true,
    maintenanceMode: false,
  });

  useEffect(() => {
    if (!prefs) return;
    setSettings({
      emailNotifications: prefs.email_notifications ?? true,
      applicationAlerts: prefs.application_alerts ?? true,
      maintenanceMode: prefs.maintenance_mode ?? false,
    });
  }, [prefs]);

  const savePrefs = useMutation({
    mutationFn: async (next: AdminPrefs) => {
      if (!prefs?.id) {
        throw new Error("No platform_settings row found");
      }
      const { error } = await supabase
        .from("platform_settings")
        .update({
          maintenance_mode: next.maintenanceMode,
          email_notifications: next.emailNotifications,
          application_alerts: next.applicationAlerts,
          updated_at: new Date().toISOString(),
        })
        .eq("id", prefs.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
      toast({
        title: t("admin.settingsPage.toast.saved"),
        description: t("admin.settingsPage.toast.savedDesc"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("admin.settingsPage.toast.saved"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const systemHealthy = statsOk && !statsError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("admin.settingsPage.title")}</h1>
        <p className="text-muted-foreground mt-2">{t("admin.settingsPage.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("admin.settingsPage.general.title")}
          </CardTitle>
          <CardDescription>{t("admin.settingsPage.general.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="maintenance">{t("admin.settingsPage.general.maintenance")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("admin.settingsPage.general.maintenanceDesc")}
              </p>
            </div>
            <Switch
              id="maintenance"
              checked={settings.maintenanceMode}
              disabled={prefsLoading}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, maintenanceMode: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t("admin.settingsPage.notifications.title")}
          </CardTitle>
          <CardDescription>{t("admin.settingsPage.notifications.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications">
                {t("admin.settingsPage.notifications.email")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("admin.settingsPage.notifications.emailDesc")}
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={settings.emailNotifications}
              disabled={prefsLoading}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, emailNotifications: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="application-alerts">
                {t("admin.settingsPage.notifications.applications")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("admin.settingsPage.notifications.applicationsDesc")}
              </p>
            </div>
            <Switch
              id="application-alerts"
              checked={settings.applicationAlerts}
              disabled={prefsLoading}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, applicationAlerts: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t("admin.settingsPage.applicationAccess.title")}
          </CardTitle>
          <CardDescription>{t("admin.settingsPage.applicationAccess.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("admin.settingsPage.applicationAccess.body")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {t("admin.settingsPage.system.title")}
          </CardTitle>
          <CardDescription>{t("admin.settingsPage.system.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("admin.settingsPage.system.databaseStatus")}</Label>
              <p className="text-sm text-muted-foreground">
                {statsLoading
                  ? "…"
                  : systemHealthy
                    ? t("admin.settingsPage.system.connected")
                    : t("admin.settingsPage.system.disconnected")}
              </p>
            </div>
            <div>
              <Label>{t("admin.settingsPage.system.apiStatus")}</Label>
              <p className="text-sm text-muted-foreground">
                {statsLoading
                  ? "…"
                  : systemHealthy
                    ? t("admin.settingsPage.system.operational")
                    : t("admin.settingsPage.system.unavailable")}
              </p>
            </div>
            <div>
              <Label>{t("admin.settingsPage.system.totalUsers")}</Label>
              {statsLoading ? (
                <Skeleton className="h-5 w-16 mt-1" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {(stats?.totalUsers ?? 0).toLocaleString()}
                </p>
              )}
            </div>
            <div>
              <Label>{t("admin.settingsPage.system.totalProjects")}</Label>
              {statsLoading ? (
                <Skeleton className="h-5 w-12 mt-1" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {(stats?.totalProjects ?? 0).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => savePrefs.mutate(settings)}
          disabled={savePrefs.isPending || prefsLoading || !prefs?.id}
        >
          {savePrefs.isPending ? t("admin.settingsPage.saving") : t("admin.settingsPage.save")}
        </Button>
      </div>
    </div>
  );
};

export default AdminSettings;
