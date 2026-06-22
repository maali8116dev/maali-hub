import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

const ReviewerSettings = () => {
  const { toast } = useToast();
  const { t } = useTranslation(["dashboard", "common"]);
  const { data: profile, isLoading: isLoadingProfile } = useProfile();
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(false);
  const [urgentApplications, setUrgentApplications] = useState(true);
  const [autoAssign, setAutoAssign] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(`${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "");
      setEmail(user?.email || "");
    }
  }, [profile, user]);

  const handleSave = async () => {
    try {
      if (profile) {
        const nameParts = name.trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        await updateProfile.mutateAsync({
          firstName: firstName || profile.firstName,
          lastName: lastName || profile.lastName,
        });
      }

      toast({
        title: t("dashboard:reviewer.settingsPage.toasts.saved"),
        description: t("dashboard:reviewer.settingsPage.toasts.savedDesc"),
      });
    } catch (error) {
      toast({
        title: t("dashboard:reviewer.settingsPage.toasts.error"),
        description: error instanceof Error ? error.message : t("dashboard:reviewer.settingsPage.toasts.saveFailed"),
        variant: "destructive",
      });
    }
  };

  if (isLoadingProfile) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-96 mt-2" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("dashboard:reviewer.pages.settings")}</h1>
        <p className="text-muted-foreground mt-2">{t("dashboard:reviewer.settingsPage.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard:reviewer.settingsPage.notifications.title")}</CardTitle>
          <CardDescription>{t("dashboard:reviewer.settingsPage.notifications.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("dashboard:settings.notifications.emailNotifications")}</Label>
              <p className="text-sm text-muted-foreground">{t("dashboard:reviewer.settingsPage.notifications.emailDesc")}</p>
            </div>
            <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("dashboard:reviewer.settingsPage.notifications.dailyDigest")}</Label>
              <p className="text-sm text-muted-foreground">{t("dashboard:reviewer.settingsPage.notifications.dailyDigestDesc")}</p>
            </div>
            <Switch checked={dailyDigest} onCheckedChange={setDailyDigest} />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("dashboard:reviewer.settingsPage.notifications.urgent")}</Label>
              <p className="text-sm text-muted-foreground">{t("dashboard:reviewer.settingsPage.notifications.urgentDesc")}</p>
            </div>
            <Switch checked={urgentApplications} onCheckedChange={setUrgentApplications} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard:reviewer.settingsPage.reviewPrefs.title")}</CardTitle>
          <CardDescription>{t("dashboard:reviewer.settingsPage.reviewPrefs.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("dashboard:reviewer.settingsPage.reviewPrefs.priority")}</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
              <option>{t("dashboard:reviewer.settingsPage.reviewPrefs.oldestFirst")}</option>
              <option>{t("dashboard:reviewer.settingsPage.reviewPrefs.newestFirst")}</option>
              <option>{t("dashboard:reviewer.settingsPage.reviewPrefs.fundingHighLow")}</option>
              <option>{t("dashboard:reviewer.settingsPage.reviewPrefs.fundingLowHigh")}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>{t("dashboard:reviewer.settingsPage.reviewPrefs.autoAssign")}</Label>
            <p className="text-sm text-muted-foreground">{t("dashboard:reviewer.settingsPage.reviewPrefs.autoAssignDesc")}</p>
            <Switch checked={autoAssign} onCheckedChange={setAutoAssign} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard:reviewer.settingsPage.profile.title")}</CardTitle>
          <CardDescription>{t("dashboard:reviewer.settingsPage.profile.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("dashboard:reviewer.settingsPage.profile.fullName")}</Label>
            <Input
              id="name"
              placeholder={t("dashboard:reviewer.settingsPage.profile.fullNamePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("dashboard:reviewer.settingsPage.profile.email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("dashboard:reviewer.settingsPage.profile.emailPlaceholder")}
              value={email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">{t("dashboard:reviewer.settingsPage.profile.emailHint")}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? t("dashboard:reviewer.settingsPage.saving") : t("dashboard:reviewer.settingsPage.save")}
        </Button>
      </div>
    </div>
  );
};

export default ReviewerSettings;
