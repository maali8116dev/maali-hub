import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, FileText, MoreHorizontal, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePartnerOpportunities, PartnerOpportunity } from "@/hooks/usePartnerOpportunities";
import { InAppTip } from "@/components/onboarding/InAppTip";
import { format } from "date-fns";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { TableSkeleton } from "@/components/ui/skeletons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const statusColors: Record<string, string> = {
  open: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  "closing-soon": "bg-amber-500/10 text-amber-600 border-amber-200",
  closed: "bg-red-500/10 text-red-600 border-red-200",
  new: "bg-blue-500/10 text-blue-600 border-blue-200",
  archived: "bg-muted text-muted-foreground",
};

const columns: ColumnDef<PartnerOpportunity>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      <div className="space-y-1">
        <span className="font-medium">{row.getValue("title")}</span>
        <p className="text-sm text-muted-foreground line-clamp-1">
          {row.original.description
            ? row.original.description.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
            : ""}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge variant="outline" className={statusColors[status] || ""}>
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "location",
    header: "Location",
  },
  {
    accessorKey: "deadline",
    header: "Deadline",
    cell: ({ row }) => format(new Date(row.getValue("deadline")), "MMM d, yyyy"),
  },
  {
    accessorKey: "currentApplicants",
    header: "Applications",
    cell: ({ row }) => {
      const current = row.getValue("currentApplicants") as number;
      const max = row.original.maxApplicants;
      return max ? `${current}/${max}` : current.toString();
    },
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const navigate = useNavigate();
      const opportunity = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/partner/opportunities/${opportunity.id}/qualified`)}>
              <Trophy className="h-4 w-4 mr-2 text-primary" />
              Qualified Applicants
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/partner/opportunities/${opportunity.id}/applications`)}>
              <FileText className="h-4 w-4 mr-2" />
              All Applications ({opportunity.currentApplicants})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/partner/opportunities/${opportunity.id}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

const PartnerOpportunities = () => {
  const navigate = useNavigate();
  const { data: opportunities = [], isLoading, refetch } = usePartnerOpportunities();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Opportunities</h1>
          <p className="text-muted-foreground">Create and manage your funding opportunities</p>
        </div>
        <Button onClick={() => navigate("/partner/opportunities/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Opportunity
        </Button>
      </div>

      {opportunities.length === 0 && !isLoading ? (
        <div className="space-y-4">
          <InAppTip
            id="partner-empty-opportunities"
            title="Create your first opportunity"
            description="Opportunities are how you attract and collect applications from qualified candidates. Create one to get started!"
            type="tip"
            dismissible={false}
          />
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">You haven't created any opportunities yet.</p>
              <Button onClick={() => navigate("/partner/opportunities/new")}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Opportunity
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <TableSkeleton rows={5} columns={6} />
            ) : (
              <DataTable
                columns={columns}
                data={opportunities}
                searchKey="title"
                searchPlaceholder="Search opportunities..."
                onRefresh={async () => { await refetch(); }}
                isRefreshing={isLoading}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PartnerOpportunities;







