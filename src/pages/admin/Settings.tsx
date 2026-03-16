import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Shield, Database, Bell, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePlatformFee, useUpdatePlatformFee } from "@/hooks/usePlatformFee";

const AdminSettings = () => {
  const { toast } = useToast();
  const { data: applicationFee = 0, isLoading: isLoadingFee } = usePlatformFee();
  const updatePlatformFee = useUpdatePlatformFee();

  const [settings, setSettings] = useState({
    emailNotifications: true,
    applicationAlerts: true,
    maintenanceMode: false,
  });
  const [localFee, setLocalFee] = useState<number>(applicationFee);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoadingFee) {
      setLocalFee(applicationFee);
    }
  }, [applicationFee, isLoadingFee]);

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    setTimeout(() => {
      toast({
        title: "Settings saved",
        description: "Admin settings have been updated.",
      });
      setSaving(false);
    }, 1000);
  };

  const handleSaveFee = async () => {
    if (Number.isNaN(localFee) || localFee < 0) {
      toast({
        title: "Invalid fee",
        description: "Application fee must be 0 or greater.",
        variant: "destructive",
      });
      return;
    }
    try {
      await updatePlatformFee.mutateAsync(Number(localFee));
      toast({
        title: "Application fee updated",
        description: "The system-wide application fee has been saved.",
      });
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error?.message || "Failed to update application fee.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure admin panel and system settings
        </p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            General Settings
          </CardTitle>
          <CardDescription>
            Configure general admin panel settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="maintenance">Maintenance Mode</Label>
              <p className="text-sm text-muted-foreground">
                Enable maintenance mode to restrict access
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

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Configure admin notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive email alerts for important events
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
              <Label htmlFor="application-alerts">Application Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when new applications are submitted
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

      {/* Application Fee */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Application Fee
          </CardTitle>
          <CardDescription>
            Set a system-wide application fee for all opportunities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="application-fee">Fee (USD)</Label>
            <Input
              id="application-fee"
              type="number"
              min="0"
              step="0.01"
              value={localFee}
              onChange={(event) => setLocalFee(Number(event.target.value))}
              className="max-w-[200px]"
            />
            <p className="text-sm text-muted-foreground">
              Use 0 for free applications.
            </p>
          </div>
          <Button onClick={handleSaveFee} disabled={updatePlatformFee.isPending}>
            {updatePlatformFee.isPending ? "Saving..." : "Save Application Fee"}
          </Button>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            System Information
          </CardTitle>
          <CardDescription>
            View system status and information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Database Status</Label>
              <p className="text-sm text-muted-foreground">Connected</p>
            </div>
            <div>
              <Label>API Status</Label>
              <p className="text-sm text-muted-foreground">Operational</p>
            </div>
            <div>
              <Label>Total Users</Label>
              <p className="text-sm text-muted-foreground">1,247</p>
            </div>
            <div>
              <Label>Total Projects</Label>
              <p className="text-sm text-muted-foreground">45</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
};

export default AdminSettings;









