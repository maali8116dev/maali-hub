import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, FileText, MoreHorizontal } from "lucide-react";
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

const PartnerOpportunities = () => {
  const navigate = useNavigate();
  const { data: opportunities = [], isLoading } = usePartnerOpportunities();

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

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading opportunities...</div>
      ) : opportunities.length === 0 ? (
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
        <div className="grid gap-4">
          {opportunities.map((opp) => (
            <Card key={opp.id}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{opp.title}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{opp.location}</span>
                    <span>•</span>
                    <span>{opp.fundingAmount}</span>
                    <span>•</span>
                    <span>Deadline: {format(new Date(opp.deadline), "MMM d, yyyy")}</span>
                  </div>
                </div>
                <Badge variant="outline" className={statusColors[opp.status] || ""}>
                  {opp.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{opp.description}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/partner/opportunities/${opp.id}/applications`)}>
                    <FileText className="h-4 w-4 mr-1" />
                    Applications ({opp.currentApplicants})
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/partner/opportunities/${opp.id}/edit`)}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PartnerOpportunities;
