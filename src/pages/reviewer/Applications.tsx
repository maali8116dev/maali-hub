import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { useReviewerApplications } from "@/hooks/useReviewerApplications";
import { Skeleton } from "@/components/ui/skeleton";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, SortableColumnHeader } from "@/components/ui/data-table";

const ReviewerApplications = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("pending"); // Default to pending

  const { data: applications = [], isLoading, error } = useReviewerApplications();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-success/10 text-success border-success/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Filter and process applications with days pending calculation
  const processedApplications = useMemo(() => {
    let filtered = applications.filter((app) => {
      return statusFilter === "all" || app.status === statusFilter;
    });

    // Add days pending calculation for all applications (useful for sorting)
    return filtered.map((app) => {
      const submittedDate = new Date(app.submittedAt);
      const today = new Date();
      const daysPending = Math.floor(
        (today.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        ...app,
        daysPending,
      };
    });
  }, [applications, statusFilter]);

  // Check if there are pending applications with 5+ days
  const hasPriorityPending = useMemo(() => {
    if (statusFilter !== "pending") return false;
    return processedApplications.some((app) => app.daysPending >= 5);
  }, [processedApplications, statusFilter]);

  // Define columns - conditionally include days pending when viewing pending
  const applicationColumns: ColumnDef<any>[] = useMemo(() => {
    const baseColumns: ColumnDef<any>[] = [
      {
        accessorKey: 'applicantName',
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Applicant" />
        ),
        cell: ({ row }) => {
          return <span className="font-medium">{row.original.applicantName}</span>;
        },
      },
      {
        accessorKey: 'projectTitle',
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Project" />
        ),
        cell: ({ row }) => {
          return <span className="text-sm">{row.original.projectTitle}</span>;
        },
      },
    ];

    // Add days pending column only when viewing pending applications
    if (statusFilter === "pending") {
      baseColumns.push({
        accessorKey: 'daysPending',
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Days Pending" />
        ),
        cell: ({ row }) => {
          const daysPending = row.original.daysPending;
          return (
            <Badge 
              className={daysPending >= 5 ? "bg-warning/10 text-warning border-warning/20" : "bg-secondary"}
            >
              <Clock className="h-3 w-3 mr-1" />
              {daysPending} {daysPending === 1 ? "day" : "days"}
            </Badge>
          );
        },
        sortingFn: (rowA, rowB) => {
          return rowA.original.daysPending - rowB.original.daysPending;
        },
      });
    }

    // Add status column when not viewing all
    if (statusFilter !== "all") {
      baseColumns.push({
        accessorKey: 'status',
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          return getStatusBadge(row.original.status);
        },
        sortingFn: (rowA, rowB) => {
          return rowA.original.status.localeCompare(rowB.original.status);
        },
      });
    }

    // Add remaining columns
    baseColumns.push(
      {
        accessorKey: 'submittedAt',
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Submitted" />
        ),
        cell: ({ row }) => {
          return (
            <span className="text-sm text-muted-foreground">
              {new Date(row.original.submittedAt).toLocaleDateString()}
            </span>
          );
        },
        sortingFn: (rowA, rowB) => {
          const dateA = new Date(rowA.original.submittedAt).getTime();
          const dateB = new Date(rowB.original.submittedAt).getTime();
          return dateA - dateB;
        },
      },
      {
        accessorKey: 'fundingAmount',
        header: ({ column }) => (
          <SortableColumnHeader column={column} title="Funding Amount" />
        ),
        cell: ({ row }) => {
          return <span className="text-sm">{row.original.fundingAmount || "N/A"}</span>;
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const app = row.original;
          return (
            <Button
              variant={statusFilter === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => navigate(`/reviewer/applications/${app.id}`)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {statusFilter === "pending" ? "Start Review" : "Review"}
            </Button>
          );
        },
      }
    );

    return baseColumns;
  }, [statusFilter, navigate]);

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Applications</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            Review and manage all submitted applications
          </p>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Applications</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            Review and manage all submitted applications
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive">
              Error loading applications: {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Applications</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          Review and manage all submitted applications ({processedApplications.length})
        </p>
      </div>

      {/* Status Filter */}
      <Card>
        <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
          <div className="flex gap-2 flex-wrap">
            {[
              { value: "all", label: "All" },
              { value: "pending", label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
            ].map((filter) => (
              <Button
                key={filter.value}
                variant={statusFilter === filter.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(filter.value)}
                className="min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial"
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Priority Alert - only show when viewing pending applications */}
      {hasPriorityPending && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-warning" />
              <div>
                <p className="font-medium">Applications pending for 5+ days</p>
                <p className="text-sm text-muted-foreground">
                  Please prioritize reviewing these applications
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Applications Table */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">
            {statusFilter === "all" 
              ? "All Applications" 
              : statusFilter === "pending"
              ? "Pending Applications"
              : statusFilter === "approved"
              ? "Approved Applications"
              : "Rejected Applications"} ({processedApplications.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <DataTable
            columns={applicationColumns}
            data={processedApplications}
            searchPlaceholder="Search by applicant name, project title, or company..."
            pageSize={10}
            enableSorting={true}
            enablePagination={true}
            enableExport={true}
            exportFileName={`applications-${statusFilter}`}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default ReviewerApplications;
