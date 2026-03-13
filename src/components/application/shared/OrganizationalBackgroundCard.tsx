import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Calendar, Users, DollarSign } from "lucide-react";
import InfoField from "./InfoField";

interface OrganizationalBackgroundCardProps {
  application: Record<string, any>;
}

const OrganizationalBackgroundCard = ({ application }: OrganizationalBackgroundCardProps) => {
  // Only render for non-individual applicants
  if (!application.applicant_type || application.applicant_type === "Individual") {
    return null;
  }

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-base sm:text-lg">Organizational Background</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {application.year_established && (
            <InfoField icon={Calendar} label="Year Established" value={application.year_established} />
          )}
          {application.team_size && (
            <InfoField icon={Users} label="Team Size" value={`${application.team_size} members`} />
          )}
          {application.previous_grants_funding_received !== undefined && (
            <InfoField
              icon={DollarSign}
              label="Previous Grants/Funding Received"
              value={application.previous_grants_funding_received ? "Yes" : "No"}
            />
          )}
        </div>
        {application.core_mission_purpose && (
          <div>
            <Label className="text-sm text-muted-foreground">Core Mission/Purpose</Label>
            <p className="mt-1 text-sm whitespace-pre-wrap">{application.core_mission_purpose}</p>
          </div>
        )}
        {application.primary_sectors && (
          <div>
            <Label className="text-sm text-muted-foreground">Primary sectors</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {Array.isArray(application.primary_sectors) ? (
                application.primary_sectors.map((sector: string, idx: number) => (
                  <Badge key={idx} variant="outline">{sector}</Badge>
                ))
              ) : typeof application.primary_sectors === "string" ? (
                (() => {
                  try {
                    const sectors = JSON.parse(application.primary_sectors);
                    return Array.isArray(sectors) ? (
                      sectors.map((sector: string, idx: number) => (
                        <Badge key={idx} variant="outline">{sector}</Badge>
                      ))
                    ) : (
                      <Badge variant="outline">{application.primary_sectors}</Badge>
                    );
                  } catch {
                    return <Badge variant="outline">{application.primary_sectors}</Badge>;
                  }
                })()
              ) : null}
            </div>
          </div>
        )}
        {application.primary_sector_other && (
          <div>
            <Label className="text-sm text-muted-foreground">Other Primary sector</Label>
            <p className="mt-1 text-sm">{application.primary_sector_other}</p>
          </div>
        )}
        {application.key_team_members_roles && (
          <div>
            <Label className="text-sm text-muted-foreground">Key Team Members & Roles</Label>
            <p className="mt-1 text-sm whitespace-pre-wrap">{application.key_team_members_roles}</p>
          </div>
        )}
        {application.previous_grants_funding_details && (
          <div>
            <Label className="text-sm text-muted-foreground">Previous Grants/Funding Details</Label>
            <p className="mt-1 text-sm whitespace-pre-wrap">{application.previous_grants_funding_details}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrganizationalBackgroundCard;









