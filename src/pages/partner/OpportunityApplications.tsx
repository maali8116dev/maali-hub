import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download } from "lucide-react";
import { usePartnerApplications, downloadApplicationsCSV } from "@/hooks/usePartnerApplications";
import { usePartnerOpportunity } from "@/hooks/usePartnerOpportunities";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  approved: "bg-emerald-500/10 text-emerald-600",
  rejected: "bg-red-500/10 text-red-600",
  "under-review": "bg-blue-500/10 text-blue-600",
};

const PartnerOpportunityApplications = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const opportunityId = id ? parseInt(id) : undefined;
  const { data: opportunity } = usePartnerOpportunity(opportunityId);
  const { data: applications = [], isLoading } = usePartnerApplications(opportunityId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Applications</h1>
          <p className="text-muted-foreground">{opportunity?.title || "Loading..."}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => downloadApplicationsCSV(applications, `applications-opportunity-${id}.csv`)}
            disabled={applications.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="ghost" onClick={() => navigate("/partner/opportunities")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading applications...</div>
          ) : applications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No applications yet for this opportunity.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.fullLegalName || "—"}</TableCell>
                    <TableCell>{app.organizationName || "—"}</TableCell>
                    <TableCell>{app.contactEmail || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[app.status || ""] || ""}>
                        {app.status || "pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(app.createdAt), "MMM d, yyyy")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerOpportunityApplications;
