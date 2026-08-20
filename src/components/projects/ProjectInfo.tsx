import DOMPurify from "dompurify";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, DollarSign, Calendar, Tag, Building2, Users, Clock, GraduationCap, Briefcase } from "lucide-react";
import { getProjectDisplayStatus, getProjectDisplayStatusKey, type ProjectDisplayStatusKey } from "@/lib/projectAvailability";
import { formatDate } from "@/lib/dateUtils";
import { formatDisplayLocation } from "@/lib/formatLocation";
import { useLocalizedOpportunity } from "@/lib/localizedContent";
import type { OpportunityWithTags } from "@/hooks/useOpportunityDetails";
import InfoField from "@/components/application/shared/InfoField";

interface ProjectInfoProps {
  project: OpportunityWithTags;
}

const getStatusColor = (key: ProjectDisplayStatusKey) => {
  switch (key) {
    case "new":
      return "bg-blue-500 text-white";
    case "closingSoon":
      return "bg-warning text-warning-foreground";
    case "open":
      return "bg-success text-success-foreground";
    case "closed":
      return "bg-muted text-muted-foreground";
    case "archived":
      return "bg-slate-500 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
};

/**
 * Component for displaying project information
 */
export function ProjectInfo({ project }: ProjectInfoProps) {
  const { t, i18n } = useTranslation("common");
  const localizedProject = useLocalizedOpportunity(project) ?? project;
  const statusKey = getProjectDisplayStatusKey(
    localizedProject.status,
    localizedProject.deadline,
    localizedProject.createdAt,
  );
  const displayStatus = getProjectDisplayStatus(
    localizedProject.status,
    localizedProject.deadline,
    localizedProject.createdAt,
    t,
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
    return new Date(dateString).toLocaleDateString(i18n.language, {
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
          <Badge variant="secondary">
            {localizedProject.sector || localizedProject.tags?.[0]?.name || t("opportunityDetail.uncategorized")}
          </Badge>
          <Badge className={getStatusColor(statusKey)}>
            {displayStatus}
          </Badge>
        </div>
        <CardTitle className="text-2xl">{localizedProject.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Project Image */}
        {project.imageUrl && (
          <div className="mb-6">
            <img
              src={project.imageUrl}
              alt={localizedProject.title}
              className="w-full h-[400px] object-cover rounded-lg"
            />
          </div>
        )}
        <div 
          className="text-muted-foreground mb-6"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(localizedProject.description || "") }}
        />

        {/* Basic Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <InfoField icon={MapPin} label={t("opportunityDetail.location")} value={formatDisplayLocation(localizedProject.location)} />
          <InfoField icon={Calendar} label={t("opportunityDetail.deadline")} value={formatProjectDate(localizedProject.deadline)} />
          <InfoField
            icon={Tag}
            label={t("opportunityDetail.sector")}
            value={localizedProject.sector || localizedProject.tags?.[0]?.name || t("opportunityDetail.uncategorized")}
          />
          {localizedProject.fundingAmount && (
            <InfoField
              icon={DollarSign}
              label={t("opportunityDetail.fundingAmount")}
              value={formatCurrency(localizedProject.fundingAmount, localizedProject.currency)}
            />
          )}
        </div>

        {/* Opportunity Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <InfoField
            icon={Briefcase}
            label={t("opportunityDetail.opportunityType")}
            value={formatOpportunityType(localizedProject.opportunityType)}
          />
          {localizedProject.organizationName && (
            <InfoField icon={Building2} label={t("opportunityDetail.organization")} value={localizedProject.organizationName} />
          )}
          {localizedProject.programFormat && (
            <InfoField
              icon={Clock}
              label={t("opportunityDetail.programFormat")}
              value={formatOpportunityType(localizedProject.programFormat)}
            />
          )}
          {localizedProject.experienceLevel && (
            <InfoField
              icon={GraduationCap}
              label={t("opportunityDetail.experienceLevel")}
              value={formatOpportunityType(localizedProject.experienceLevel)}
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









