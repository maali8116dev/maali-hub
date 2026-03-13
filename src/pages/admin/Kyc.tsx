import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, SortableColumnHeader } from "@/components/ui/data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useUsers } from "@/hooks/useUsers";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  verified: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  expired: "bg-muted text-muted-foreground",
};

const AdminKyc = () => {
  const navigate = useNavigate();
  const { data: users = [], isLoading: usersLoading } = useUsers();

  const {
    data: kycRows = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["kyc-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kyc_verifications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const rows = useMemo(() => {
    const userMap = new Map(
      users.map((u) => [u.userId, u])
    );
    return kycRows.map((kyc) => {
      const user = userMap.get(kyc.user_id);
      return {
        ...kyc,
        name: user?.name || kyc.full_name_on_id || "Unknown",
        email: user?.email || "Unknown",
      };
    });
  }, [kycRows, users]);

  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="User" />
        ),
        cell: ({ row }) => {
          const { name, email } = row.original;
          return (
            <div>
              <p className="font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">{email}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "id_type",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="ID Type" />
        ),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.id_type?.replace("_", " ")}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={STATUS_STYLES[row.original.status] || ""}
          >
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: "created_at",
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Submitted" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {new Date(row.original.created_at).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Action",
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/admin/users/${row.original.user_id}`)}
          >
            Review
          </Button>
        ),
      },
    ],
    [navigate]
  );

  if (isLoading || usersLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>KYC Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert>
        <AlertTitle>Failed to load KYC requests</AlertTitle>
        <AlertDescription>
          {(error as Error).message}
          <Button
            variant="outline"
            size="sm"
            className="ml-3"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">KYC Requests</h1>
        <p className="text-muted-foreground">
          Review and approve submitted identity verifications.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All requests</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={rows} />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminKyc;
