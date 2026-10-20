import { useMemo, useState, useCallback } from "react";
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
import { useTranslation } from "react-i18next";

const ROLE_OPTIONS = ["applicant", "reviewer", "partner", "admin"] as const;

const AdminUserDetails = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { t } = useTranslation(["dashboard", "common"]);
  const { data: users = [], isLoading, error } = useUsers();
  const updateUserRole = useUpdateUserRole();
  const [roleChangeDialogOpen, setRoleChangeDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"admin" | "reviewer" | "applicant" | "partner" | null>(null);

  const roleLabel = useCallback(
    (role: string) => t(`common:status.role.${role}`, { defaultValue: role }),
    [t],
  );

  const accountStatusLabel = useCallback(
    (status: string) => t(`common:status.account.${status}`, { defaultValue: status }),
    [t],
  );

  const user = useMemo(() => {
    if (!userId) return null;
    return users.find((item) => item.userId === userId) || null;
  }, [users, userId]);

  const handleRoleChange = (newRole: "admin" | "reviewer" | "applicant" | "partner") => {
    if (!user) return;
    if (newRole === user.role) return;
    setSelectedRole(newRole);
    setRoleChangeDialogOpen(true);
  };

  const handleConfirmRoleChange = () => {
    if (!user || !selectedRole) return;
    if (user.userId === currentUser?.id) return;

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

  const renderRoleBadge = (role: string) => {
    if (role === "admin") {
      return <Badge variant="secondary">{roleLabel(role)}</Badge>;
    }
    return <Badge variant="outline">{roleLabel(role)}</Badge>;
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
          {t("admin.userDetailsPage.back")}
        </Button>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>
                {error instanceof Error ? error.message : t("admin.userDetailsPage.notFound")}
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
          {t("admin.userDetailsPage.back")}
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
                  {user.businessName || t("admin.userDetailsPage.noBusinessName")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {renderRoleBadge(user.role)}
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
                {accountStatusLabel(user.status)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("admin.userDetailsPage.cards.email")}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{user.email}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("admin.userDetailsPage.cards.joined")}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{new Date(user.registeredAt).toLocaleDateString()}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("admin.userDetailsPage.cards.applications")}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>{t("admin.userDetailsPage.applicationCount", { count: user.applicationsCount })}</span>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("admin.userDetailsPage.businessDetails")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("admin.userDetailsPage.fields.businessName")}</span>
              <span>{user.businessName || t("admin.userDetailsPage.fields.notProvided")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("admin.userDetailsPage.fields.businessSector")}</span>
              <span>{user.businesssector || t("admin.userDetailsPage.fields.notProvided")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("admin.userDetailsPage.fields.country")}</span>
              <span>{user.country || t("admin.userDetailsPage.fields.notProvided")}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("admin.userDetailsPage.bio")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {user.bio || t("admin.userDetailsPage.fields.noBio")}
            </p>
          </CardContent>
        </Card>
      </div>

      <KycReviewCard userId={user.userId} profileName={user.name} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t("admin.userDetailsPage.roleManagement.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t("admin.userDetailsPage.roleManagement.currentRole")}</p>
              <p className="text-xs text-muted-foreground">
                {t("admin.userDetailsPage.roleManagement.description")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {renderRoleBadge(user.role)}
            </div>
          </div>
          {user.userId !== currentUser?.id ? (
            <div className="flex items-center gap-2">
              <Select
                value={user.role}
                onValueChange={(value) =>
                  handleRoleChange(value as "admin" | "reviewer" | "applicant" | "partner")
                }
                disabled={updateUserRole.isPending}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("admin.userDetailsPage.roleManagement.selectRole")} />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabel(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {updateUserRole.isPending && (
                <span className="text-sm text-muted-foreground">{t("admin.userDetailsPage.roleManagement.updating")}</span>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("admin.userDetailsPage.roleManagement.cannotChangeOwnRole")}
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={roleChangeDialogOpen} onOpenChange={setRoleChangeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.userDetailsPage.roleChangeDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.userDetailsPage.roleChangeDialog.description", {
                name: user.name,
                fromRole: roleLabel(user.role),
                toRole: selectedRole ? roleLabel(selectedRole) : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateUserRole.isPending}>
              {t("admin.userDetailsPage.roleChangeDialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRoleChange}
              disabled={updateUserRole.isPending}
            >
              {updateUserRole.isPending
                ? t("admin.userDetailsPage.roleChangeDialog.confirming")
                : t("admin.userDetailsPage.roleChangeDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUserDetails;
