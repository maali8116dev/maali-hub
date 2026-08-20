import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Shield, Database, Bell, CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAdminStats } from "@/hooks/useAdminStats";

const AdminSettings = () => {
  const { t } = useTranslation(["dashboard"]);
  const { toast } = useToast();
  const { data: stats, isLoading: statsLoading, isError: statsError, isSuccess: statsOk } = useAdminStats();

  const [settings, setSettings] = useState({
    emailNotifications: true,
    applicationAlerts: true,
    maintenanceMode: false,
  });

  const [saving, setSaving] = useState(false);
  const systemHealthy = statsOk && !statsError;

  const handleSave = async () => {
    setSaving(true);
    setTimeout(() => {
      toast({
        title: t("admin.settingsPage.toast.saved"),
        description: t("admin.settingsPage.toast.savedDesc"),
      });
      setSaving(false);
    }, 1000);
  };

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
        <Button onClick={handleSave} disabled={saving}>
          {saving ? t("admin.settingsPage.saving") : t("admin.settingsPage.save")}
        </Button>
      </div>
    </div>
  );
};

export default AdminSettings;
