import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Building2, Users } from "lucide-react";
import InfoField from "./InfoField";

interface ProjectDetailsCardProps {
  application: Record<string, any>;
  /** Whether to show the "View Project" link at the top (used in admin/applicant views) */
  showProjectLink?: boolean;
}

const ProjectDetailsCard = ({ application, showProjectLink = false }: ProjectDetailsCardProps) => (
  <Card>
    <CardHeader className="p-4 sm:p-6">
      <CardTitle className="text-base sm:text-lg">Project Details</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
      {/* Project link section (optional) */}
      {showProjectLink && application.project && (
        <div className="mb-4 pb-4 border-b">
          <InfoField icon={Building2} label="Project" value={application.project.title} breakWords />
          <Link to={`/projects/${application.project_id}`} className="mt-3 block">
            <Button variant="outline" className="w-full min-h-[44px]">
              View Project Details
            </Button>
          </Link>
        </div>
      )}

      {application.project_title && (
        <div>
          <Label className="text-sm text-muted-foreground">Project Title</Label>
          <p className="font-medium mt-1">{application.project_title}</p>
        </div>
      )}
      {!application.project_title && application.projectTitle && (
        <div>
          <Label className="text-sm text-muted-foreground">Project Title</Label>
          <p className="font-medium mt-1">{application.projectTitle}</p>
        </div>
      )}
      {application.project_summary && (
        <div>
          <Label className="text-sm text-muted-foreground">Project Summary</Label>
          <p className="mt-1 text-sm whitespace-pre-wrap">{application.project_summary}</p>
        </div>
      )}
      {application.geographic_focus && (
        <div>
          <Label className="text-sm text-muted-foreground">Geographic Focus</Label>
          <p className="mt-1 text-sm">{application.geographic_focus}</p>
        </div>
      )}
      {application.team_size && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoField icon={Users} label="Team Size" value={`${application.team_size} members`} />
        </div>
      )}
    </CardContent>
  </Card>
);

export default ProjectDetailsCard;

