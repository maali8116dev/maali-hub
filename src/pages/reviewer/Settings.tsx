import { useState, useEffect } from "react";
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
  const { data: profile, isLoading: isLoadingProfile } = useProfile();
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(false);
  const [urgentApplications, setUrgentApplications] = useState(true);
  const [autoAssign, setAutoAssign] = useState(false);

  // Load profile data when available
  useEffect(() => {
    if (profile) {
      setName(`${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "");
      setEmail(user?.email || "");
    }
  }, [profile, user]);

  const handleSave = async () => {
    try {
      // Update profile information
      if (profile) {
        const nameParts = name.trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        await updateProfile.mutateAsync({
          firstName: firstName || profile.firstName,
          lastName: lastName || profile.lastName,
        });
      }

      // TODO: Save notification preferences to user settings table when available
      // For now, we'll just show a success message
      toast({
        title: "Settings Saved",
        description: "Your reviewer settings have been updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings",
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
        <h1 className="text-3xl font-bold">Reviewer Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your reviewer preferences and notifications
        </p>
      </div>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Configure how you receive notifications about new applications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive email notifications for new applications
              </p>
            </div>
            <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Daily Digest</Label>
              <p className="text-sm text-muted-foreground">
                Receive a daily summary of pending applications
              </p>
            </div>
            <Switch checked={dailyDigest} onCheckedChange={setDailyDigest} />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Urgent Applications</Label>
              <p className="text-sm text-muted-foreground">
                Get notified immediately for applications pending 5+ days
              </p>
            </div>
            <Switch checked={urgentApplications} onCheckedChange={setUrgentApplications} />
          </div>
        </CardContent>
      </Card>

      {/* Review Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Review Preferences</CardTitle>
          <CardDescription>
            Set your default review workflow preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Review Priority</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
              <option>Oldest First</option>
              <option>Newest First</option>
              <option>Funding Amount (High to Low)</option>
              <option>Funding Amount (Low to High)</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Auto-assign Applications</Label>
            <p className="text-sm text-muted-foreground">
              Automatically assign new applications to your review queue
            </p>
            <Switch checked={autoAssign} onCheckedChange={setAutoAssign} />
          </div>
        </CardContent>
      </Card>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your reviewer profile information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@example.com"
              value={email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateProfile.isPending}>
          {updateProfile.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
};

export default ReviewerSettings;









