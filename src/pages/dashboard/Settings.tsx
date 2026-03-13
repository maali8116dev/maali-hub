import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { Bell, Shield, Globe, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

const Settings = () => {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { i18n, t } = useTranslation(['dashboard']);
  
  const [settings, setSettings] = useState({
    emailNotifications: true,
    applicationUpdates: true,
    newsletter: false,
    language: i18n.language || "en",
  });

  // Update language when i18n language changes
  useEffect(() => {
    setSettings(prev => ({ ...prev, language: i18n.language || "en" }));
  }, [i18n.language]);

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    setTimeout(() => {
      toast({
        title: t('dashboard:settings.save.saved'),
        description: t('dashboard:settings.save.savedDesc'),
      });
      setSaving(false);
    }, 1000);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{t('dashboard:settings.title')}</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          {t('dashboard:settings.subtitle')}
        </p>
      </div>

      {/* Notifications */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle className="text-base sm:text-lg">{t('dashboard:settings.notifications.title')}</CardTitle>
          </div>
          <CardDescription className="text-xs sm:text-sm">
            {t('dashboard:settings.notifications.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5 flex-1 min-w-0">
              <Label htmlFor="email-notifications" className="text-sm">{t('dashboard:settings.notifications.emailNotifications')}</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t('dashboard:settings.notifications.emailNotificationsDesc')}
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={settings.emailNotifications}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, emailNotifications: checked })
              }
              className="flex-shrink-0"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5 flex-1 min-w-0">
              <Label htmlFor="application-updates" className="text-sm">{t('dashboard:settings.notifications.applicationUpdates')}</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t('dashboard:settings.notifications.applicationUpdatesDesc')}
              </p>
            </div>
            <Switch
              id="application-updates"
              checked={settings.applicationUpdates}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, applicationUpdates: checked })
              }
              className="flex-shrink-0"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5 flex-1 min-w-0">
              <Label htmlFor="newsletter" className="text-sm">{t('dashboard:settings.notifications.newsletter')}</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t('dashboard:settings.notifications.newsletterDesc')}
              </p>
            </div>
            <Switch
              id="newsletter"
              checked={settings.newsletter}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, newsletter: checked })
              }
              className="flex-shrink-0"
            />
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            <CardTitle className="text-base sm:text-lg">{t('dashboard:settings.preferences.title')}</CardTitle>
          </div>
          <CardDescription className="text-xs sm:text-sm">
            {t('dashboard:settings.preferences.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language">{t('dashboard:settings.preferences.language')}</Label>
            <Select
              value={settings.language}
              onValueChange={(value) => {
                setSettings({ ...settings, language: value });
                i18n.changeLanguage(value);
                toast({
                  title: t('dashboard:settings.save.languageUpdated'),
                  description: `${t('dashboard:settings.preferences.language')} ${value === 'en' ? 'English' : value === 'fr' ? 'FranÃ§ais' : 'PortuguÃªs'}`,
                });
              }}
            >
              <SelectTrigger id="language" className="h-11 sm:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">FranÃ§ais</SelectItem>
                {/* <SelectItem value="pt">PortuguÃªs</SelectItem> */}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="theme">{t('dashboard:settings.preferences.theme')}</Label>
            <Select
              value={theme || "system"}
              onValueChange={(value) => {
                setTheme(value);
                toast({
                  title: t('dashboard:settings.save.themeUpdated'),
                  description: `${t('dashboard:settings.preferences.theme')} ${value === 'light' ? t('dashboard:settings.preferences.light') : value === 'dark' ? t('dashboard:settings.preferences.dark') : t('dashboard:settings.preferences.system')}`,
                });
              }}
            >
              <SelectTrigger id="theme" className="h-11 sm:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{t('dashboard:settings.preferences.light')}</SelectItem>
                <SelectItem value="dark">{t('dashboard:settings.preferences.dark')}</SelectItem>
                <SelectItem value="system">{t('dashboard:settings.preferences.system')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle className="text-base sm:text-lg">{t('dashboard:settings.security.title')}</CardTitle>
          </div>
          <CardDescription className="text-xs sm:text-sm">
            {t('dashboard:settings.security.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">{t('dashboard:settings.security.currentPassword')}</Label>
            <Input
              id="current-password"
              type="password"
              placeholder={t('dashboard:settings.security.enterCurrentPassword')}
              className="h-11 sm:h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">{t('dashboard:settings.security.newPassword')}</Label>
            <Input
              id="new-password"
              type="password"
              placeholder={t('dashboard:settings.security.enterNewPassword')}
              className="h-11 sm:h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t('dashboard:settings.security.confirmPassword')}</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder={t('dashboard:settings.security.confirmNewPassword')}
              className="h-11 sm:h-10"
            />
          </div>
          <Button variant="outline" className="min-h-[44px]">{t('dashboard:settings.security.updatePassword')}</Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-destructive text-base sm:text-lg">{t('dashboard:settings.dangerZone.title')}</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {t('dashboard:settings.dangerZone.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-sm sm:text-base">{t('dashboard:settings.dangerZone.deleteAccount')}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t('dashboard:settings.dangerZone.deleteAccountDesc')}
              </p>
            </div>
            <Button variant="destructive" className="min-h-[44px] w-full sm:w-auto">{t('dashboard:settings.dangerZone.deleteAccount')}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg" className="min-h-[44px] w-full sm:w-auto">
          {saving ? t('dashboard:settings.save.saving') : t('dashboard:settings.save.saveChanges')}
        </Button>
      </div>
    </div>
  );
};

export default Settings;









