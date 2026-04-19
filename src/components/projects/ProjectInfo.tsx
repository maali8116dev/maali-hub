import DOMPurify from "dompurify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, DollarSign, Calendar, Tag, Building2, Users, Clock, GraduationCap, Briefcase, CreditCard } from "lucide-react";
import { getProjectDisplayStatus } from "@/lib/projectAvailability";
import { formatDate } from "@/lib/dateUtils";
import type { OpportunityWithTags } from "@/hooks/useOpportunityDetails";
import InfoField from "@/components/application/shared/InfoField";
import { usePlatformFee } from "@/hooks/usePlatformFee";

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
  const { data: applicationFee = 0 } = usePlatformFee();
  const displayStatus = getProjectDisplayStatus(
    project.status,
    project.deadline,
    project.createdAt,
  );

const formatOpportunityType = (type: string) => {
  return type.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

const formatCurrency = (amount: string, currency: string) => {
  const currencySymbols: Record<string, string> = {
    'USD': '$',
    'EUR': 'â‚¬',
    'GBP': 'Â£',
    'CAD': 'C$',
    'AUD': 'A$'
  };
  
  const symbol = currencySymbols[currency] || currency;
  return `${symbol}${amount}`;
};

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
          <Badge variant="secondary">{project.sector || project.tags?.[0]?.name || "Uncategorized"}</Badge>
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
              className="w-full h-[400px] object-cover rounded-lg"
            />
          </div>
        )}
        <div 
          className="text-muted-foreground mb-6"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(project.description || "") }}
        />

        {/* Basic Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <InfoField 
            icon={MapPin} 
            label="Location" 
            value={project.location}
          />
        
          <InfoField 
            icon={Calendar} 
            label="Application Deadline" 
            value={formatProjectDate(project.deadline)}
          />
          <InfoField 
            icon={Tag} 
            label="Sector" 
            value={project.sector || project.tags?.[0]?.name || "Uncategorized"}
          />
          { project.fundingAmount && (
            <InfoField 
            icon={DollarSign} 
            label="Funding Amount" 
            value={formatCurrency(project.fundingAmount, project.currency)}
          />)}
        </div>

        {/* Opportunity Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <InfoField 
            icon={Briefcase} 
            label="Opportunity Type" 
            value={formatOpportunityType(project.opportunityType)}
          />
          {project.organizationName && (
            <InfoField 
              icon={Building2} 
              label="Organization" 
              value={project.organizationName}
            />
          )}
          {project.programFormat && (
            <InfoField 
              icon={Clock} 
              label="Program Format" 
              value={formatOpportunityType(project.programFormat)}
            />
          )}
          {project.experienceLevel && (
            <InfoField 
              icon={GraduationCap} 
              label="Experience Level" 
              value={formatOpportunityType(project.experienceLevel)}
            />
          )}
        </div>

        {/* Application & Capacity Information */}
        {/* {(applicationFee > 0 || project.maxApplicants || project.currentApplicants > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {applicationFee > 0 && (
              <InfoField 
                icon={CreditCard} 
                label="Application Fee" 
                value={formatCurrency(applicationFee.toString(), project.currency)}
              />
            )}
            {project.maxApplicants && (
              <InfoField 
                icon={Users} 
                label="Maximum Applicants" 
                value={project.maxApplicants.toString()}
              />
            )}
            {project.currentApplicants > 0 && (
              <InfoField 
                icon={Users} 
                label="Current Applicants" 
                value={project.currentApplicants.toString()}
              />
            )}
          </div>
        )} */}

      </CardContent>
    </Card>
  );
}









