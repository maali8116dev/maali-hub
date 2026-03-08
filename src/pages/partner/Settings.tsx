import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

const PartnerSettings = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your partner account settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="text-sm font-medium text-muted-foreground">Email</span>
            <p className="text-sm">{user?.email || "—"}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-muted-foreground">Role</span>
            <p className="text-sm">Partner</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerSettings;
