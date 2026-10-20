import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Target, CheckCircle2 } from "lucide-react";
import { ListItemsRenderer } from "@/components/projects/ListItemsRenderer";
import { useLocalizedOpportunity } from "@/lib/localizedContent";
import type { OpportunityWithTags } from "@/hooks/useOpportunityDetails";

interface ProjectRequirementsProps {
  project: OpportunityWithTags;
}

/**
 * Component for displaying project requirements and eligibility criteria
 */
export function ProjectRequirements({ project }: ProjectRequirementsProps) {
  const { t } = useTranslation("common");
  const localizedProject = useLocalizedOpportunity(project) ?? project;

  return (
    <>
      {/* Requirements */}
      {localizedProject.requirements && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              {t("opportunityDetail.requirements")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ListItemsRenderer
              items={localizedProject.requirements}
              variant="primary"
              icon={CheckCircle2}
            />
          </CardContent>
        </Card>
      )}

      {/* Eligibility Criteria */}
      {localizedProject.eligibilityCriteria && (
        <Card className="border-l-4 border-l-success">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-success/10 rounded-lg">
                <Target className="h-5 w-5 text-success" />
              </div>
              {t("opportunityDetail.eligibilityCriteria")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ListItemsRenderer
              items={localizedProject.eligibilityCriteria}
              variant="success"
              icon={CheckCircle2}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}









