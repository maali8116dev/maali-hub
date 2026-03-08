import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mail, Calendar, FileText, Shield, AlertCircle } from "lucide-react";
import { useUsers, useUpdateUserRole } from "@/hooks/useUsers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { KycReviewCard } from "@/components/admin/KycReviewCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const AdminUserDetails = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { data: users = [], isLoading, error } = useUsers();
  const updateUserRole = useUpdateUserRole();
  const [roleChangeDialogOpen, setRoleChangeDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"admin" | "reviewer" | "applicant" | null>(null);

  const user = useMemo(() => {
    if (!userId) return null;
    return users.find((item) => item.userId === userId) || null;
  }, [users, userId]);

  const handleRoleChange = (newRole: "admin" | "reviewer" | "applicant") => {
    if (!user) return;
    // Only show dialog if role is actually changing
    if (newRole === user.role) return;
    setSelectedRole(newRole);
    setRoleChangeDialogOpen(true);
  };

  const handleConfirmRoleChange = () => {
    if (!user || !selectedRole) return;
    
    // Prevent changing own role
    if (user.userId === currentUser?.id) {
      return;
    }

    updateUserRole.mutate(
      { userId: user.userId, role: selectedRole },
      {
        onSuccess: () => {
          setRoleChangeDialogOpen(false);
          setSelectedRole(null);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/admin/users")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>
                {error instanceof Error
                  ? error.message
                  : "User not found."}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/admin/users")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.avatarUrl || undefined} alt={user.name} />
                <AvatarFallback>
                  {user.name
                    .split(" ")
                    .map((part) => part.charAt(0))
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">{user.name}</h1>
                <p className="text-muted-foreground">
                  {user.businessName || "No business name"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {user.role === "admin" ? (
                <Badge variant="secondary">Admin</Badge>
              ) : user.role === "reviewer" ? (
                <Badge variant="outline">Reviewer</Badge>
              ) : (
                <Badge variant="outline">Applicant</Badge>
              )}
              <Badge
                variant="outline"
                className={`text-xs ${
                  user.status === "active"
                    ? "bg-success/10 text-success border-success/20"
                    : user.status === "suspended"
                    ? "bg-warning/10 text-warning border-warning/20"
                    : "bg-destructive/10 text-destructive border-destructive/20"
                }`}
              >
                {user.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Email</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{user.email}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Joined</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{new Date(user.registeredAt).toLocaleDateString()}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Applications</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>
              {user.applicationsCount}{" "}
              {user.applicationsCount === 1 ? "application" : "applications"}
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Business Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Business Name</span>
              <span>{user.businessName || "Not provided"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Business Sector</span>
              <span>{user.businessSector || "Not provided"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Country</span>
              <span>{user.country || "Not provided"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Bio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {user.bio || "No bio provided"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* KYC Verification Card */}
      <KycReviewCard userId={user.userId} profileName={user.name} />

      {/* Role Management Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Role Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Current Role</p>
              <p className="text-xs text-muted-foreground">
                Change the user's role to grant different permissions
              </p>
            </div>
            <div className="flex items-center gap-3">
              {user.role === "admin" ? (
                <Badge variant="secondary">Admin</Badge>
              ) : user.role === "reviewer" ? (
                <Badge variant="outline">Reviewer</Badge>
              ) : (
                <Badge variant="outline">Applicant</Badge>
              )}
            </div>
          </div>
          {user.userId !== currentUser?.id ? (
            <div className="flex items-center gap-2">
              <Select
                value={user.role}
                onValueChange={(value) =>
                  handleRoleChange(value as "admin" | "reviewer" | "applicant")
                }
                disabled={updateUserRole.isPending}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="applicant">Applicant</SelectItem>
                  <SelectItem value="reviewer">Reviewer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              {updateUserRole.isPending && (
                <span className="text-sm text-muted-foreground">Updating...</span>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              You cannot change your own role.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Role Change Confirmation Dialog */}
      <AlertDialog open={roleChangeDialogOpen} onOpenChange={setRoleChangeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change User Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change <strong>{user.name}</strong>'s role from{" "}
              <strong>{user.role}</strong> to <strong>{selectedRole}</strong>? This will
              immediately affect their access permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateUserRole.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRoleChange}
              disabled={updateUserRole.isPending}
            >
              {updateUserRole.isPending ? "Updating..." : "Change Role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUserDetails;

