import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, DollarSign, Calendar, Tag, Building2, Users, Clock, GraduationCap, Briefcase, CreditCard } from "lucide-react";
import { getProjectDisplayStatus } from "@/lib/projectAvailability";
import { formatDate } from "@/lib/dateUtils";
import type { OpportunityWithTags } from "@/hooks/useOpportunityDetails";
import InfoField from "@/components/application/shared/InfoField";

interface ProjectInfoProps {
  project: OpportunityWithTags;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "New":
      return "bg-blue-500 text-white";
    case "Closing Soon":
      return "bg-warning text-warning-foreground";
    case "Open":
      return "bg-success text-success-foreground";
    case "Closed":
      return "bg-muted text-muted-foreground";
    case "Archived":
      return "bg-slate-500 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
};

/**
 * Component for displaying project information
 */
export function ProjectInfo({ project }: ProjectInfoProps) {
  const displayStatus = getProjectDisplayStatus(
    project.status,
    project.deadline,
    project.createdAt,
  );

  const formatProjectDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start mb-4">
          <Badge variant="secondary">{project.tags?.[0]?.name || "Uncategorized"}</Badge>
          <Badge className={getStatusColor(displayStatus)}>
            {displayStatus}
          </Badge>
        </div>
        <CardTitle className="text-2xl">{project.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Project Image */}
        {project.imageUrl && (
          <div className="mb-6">
            <img
              src={project.imageUrl}
              alt={project.title}
              className="w-full h-64 object-cover rounded-lg"
            />
          </div>
        )}
        <p className="text-muted-foreground mb-6">{project.description}</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <span>{project.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <span>{project.fundingAmount}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <span>Deadline: {formatProjectDate(project.deadline)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-muted-foreground" />
            <span>Category: {project.tags?.[0]?.name || "Uncategorized"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

