import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Calendar, FileText, Shield, AlertCircle } from "lucide-react";
import { useUsers, useSuspendUser, useActivateUser } from "@/hooks/useUsers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, SortableColumnHeader } from "@/components/ui/data-table";
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

const AdminUsers = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(["dashboard", "common"]);
  const { data: users = [], isLoading, error, refetch, isFetching } = useUsers();
  const suspendUser = useSuspendUser();
  const activateUser = useActivateUser();
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ userId: string; name: string } | null>(null);

  const roleLabel = useCallback(
    (role: string) => t(`common:status.role.${role}`, { defaultValue: role }),
    [t],
  );

  const accountStatusLabel = useCallback(
    (status: string) => t(`common:status.account.${status}`, { defaultValue: status }),
    [t],
  );

  const handleSuspendClick = (userId: string, userName: string) => {
    setSelectedUser({ userId, name: userName });
    setSuspendDialogOpen(true);
  };

  const handleActivateClick = (userId: string, userName: string) => {
    setSelectedUser({ userId, name: userName });
    setActivateDialogOpen(true);
  };

  const handleConfirmSuspend = () => {
    if (selectedUser) {
      suspendUser.mutate(selectedUser.userId, {
        onSuccess: () => {
          setSuspendDialogOpen(false);
          setSelectedUser(null);
        },
      });
    }
  };

  const handleConfirmActivate = () => {
    if (selectedUser) {
      activateUser.mutate(selectedUser.userId, {
        onSuccess: () => {
          setActivateDialogOpen(false);
          setSelectedUser(null);
        },
      });
    }
  };

  const userColumns: ColumnDef<any>[] = useMemo(() => [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title={t("admin.usersPage.columns.name")} />
      ),
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {user.email}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: 'role',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title={t("admin.usersPage.columns.role")} />
      ),
      cell: ({ row }) => {
        const user = row.original;
        if (user.role === "admin") {
          return (
            <Badge variant="secondary" className="text-xs">
              <Shield className="h-3 w-3 mr-1" />
              {roleLabel(user.role)}
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="text-xs">
            {roleLabel(user.role)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title={t("admin.usersPage.columns.status")} />
      ),
      cell: ({ row }) => {
        const user = row.original;
        return (
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
        );
      },
    },
    {
      accessorKey: 'registeredAt',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title={t("admin.usersPage.columns.joined")} />
      ),
      cell: ({ row }) => {
        return (
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(row.original.registeredAt).toLocaleDateString()}
          </span>
        );
      },
      sortingFn: (rowA, rowB) => {
        const dateA = new Date(rowA.original.registeredAt).getTime();
        const dateB = new Date(rowB.original.registeredAt).getTime();
        return dateA - dateB;
      },
    },
    {
      accessorKey: 'applicationsCount',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title={t("admin.usersPage.columns.applications")} />
      ),
      cell: ({ row }) => {
        const count = row.original.applicationsCount;
        return (
          <span className="text-sm flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {t("admin.usersPage.applicationCount", { count })}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: t("admin.usersPage.columns.actions"),
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/admin/users/${user.userId}`)}
            >
              {t("admin.usersPage.viewProfile")}
            </Button>
            {user.role !== "admin" && user.status === "active" && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => handleSuspendClick(user.userId, user.name)}
                disabled={suspendUser.isPending}
              >
                {t("admin.usersPage.suspend")}
              </Button>
            )}
            {user.status === "suspended" && (
              <Button
                variant="outline"
                size="sm"
                className="text-success"
                onClick={() => handleActivateClick(user.userId, user.name)}
                disabled={activateUser.isPending}
              >
                {t("admin.usersPage.activate")}
              </Button>
            )}
          </div>
        );
      },
    },
  ], [navigate, t, roleLabel, accountStatusLabel, suspendUser.isPending, activateUser.isPending]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{t("admin.usersPage.title")}</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          {t("admin.usersPage.subtitle")}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("admin.usersPage.errorTitle")}</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : t("admin.usersPage.loadError")}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {isLoading
              ? t("admin.usersPage.tableTitleLoading")
              : t("admin.usersPage.tableTitle", { count: users.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="font-medium mb-2">{t("admin.usersPage.emptyTitle")}</p>
              <p className="text-sm">{t("admin.usersPage.emptyDescription")}</p>
            </div>
          ) : (
            <DataTable
              columns={userColumns}
              data={users}
              searchPlaceholder={t("admin.usersPage.searchPlaceholder")}
              pageSize={10}
              enableSorting={true}
              enablePagination={true}
              exportFileName="users"
              onRefresh={() => { refetch(); }}
              isRefreshing={isFetching}
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.usersPage.suspendDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.usersPage.suspendDialog.description", { name: selectedUser?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={suspendUser.isPending}>
              {t("admin.usersPage.suspendDialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSuspend}
              disabled={suspendUser.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {suspendUser.isPending ? t("admin.usersPage.suspendDialog.confirming") : t("admin.usersPage.suspendDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.usersPage.activateDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.usersPage.activateDialog.description", { name: selectedUser?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={activateUser.isPending}>
              {t("admin.usersPage.activateDialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmActivate}
              disabled={activateUser.isPending}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {activateUser.isPending ? t("admin.usersPage.activateDialog.confirming") : t("admin.usersPage.activateDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;
