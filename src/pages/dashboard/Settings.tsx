import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { Bell, Shield, Globe, Mail } from "lucide-react";

const Settings = () => {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  
  const [settings, setSettings] = useState({
    emailNotifications: true,
    applicationUpdates: true,
    newsletter: false,
    language: "en",
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    setTimeout(() => {
      toast({
        title: "Settings saved",
        description: "Your preferences have been updated.",
      });
      setSaving(false);
    }, 1000);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Notifications */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle className="text-base sm:text-lg">Notifications</CardTitle>
          </div>
          <CardDescription className="text-xs sm:text-sm">
            Choose what notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5 flex-1 min-w-0">
              <Label htmlFor="email-notifications" className="text-sm">Email Notifications</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Receive email updates about your applications
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
              <Label htmlFor="application-updates" className="text-sm">Application Updates</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Get notified when your application status changes
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
              <Label htmlFor="newsletter" className="text-sm">Newsletter</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Receive our monthly newsletter with funding opportunities
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
            <CardTitle className="text-base sm:text-lg">Preferences</CardTitle>
          </div>
          <CardDescription className="text-xs sm:text-sm">
            Customize your experience
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <Select
              value={settings.language}
              onValueChange={(value) =>
                setSettings({ ...settings, language: value })
              }
            >
              <SelectTrigger id="language" className="h-11 sm:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="pt">Português</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Select
              value={theme || "system"}
              onValueChange={(value) => {
                setTheme(value);
                toast({
                  title: "Theme updated",
                  description: `Theme changed to ${value}`,
                });
              }}
            >
              <SelectTrigger id="theme" className="h-11 sm:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
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
            <CardTitle className="text-base sm:text-lg">Security</CardTitle>
          </div>
          <CardDescription className="text-xs sm:text-sm">
            Manage your account security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              placeholder="Enter current password"
              className="h-11 sm:h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Enter new password"
              className="h-11 sm:h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Confirm new password"
              className="h-11 sm:h-10"
            />
          </div>
          <Button variant="outline" className="min-h-[44px]">Update Password</Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-destructive text-base sm:text-lg">Danger Zone</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-sm sm:text-base">Delete Account</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Permanently delete your account and all associated data
              </p>
            </div>
            <Button variant="destructive" className="min-h-[44px] w-full sm:w-auto">Delete Account</Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg" className="min-h-[44px] w-full sm:w-auto">
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};

export default Settings;

