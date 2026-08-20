import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePartnerOpportunities } from "@/hooks/usePartnerOpportunities";
import { pickLocalizedField } from "@/lib/localizedContent";
import { getProjectStatusBadge } from "@/lib/statusBadges";

export function PartnerRecentOpportunities() {
  const { t, i18n } = useTranslation("dashboard");
  const { data: opportunities = [], isLoading } = usePartnerOpportunities();
  const recent = opportunities.slice(0, 5);

  if (isLoading || recent.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>{t("partner.dashboardPage.recentOpportunities.title")}</CardTitle>
          <CardDescription>{t("partner.dashboardPage.recentOpportunities.description")}</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/partner/opportunities">
            {t("partner.dashboardPage.recentOpportunities.viewAll")}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {recent.map((opportunity) => {
          const title = pickLocalizedField(
            i18n.language,
            opportunity.title,
            opportunity.translations,
            "title",
          );
          const applicationsPath = `/partner/opportunities/${opportunity.id}/applications`;
          const detailsPath = `/partner/opportunities/${opportunity.id}`;

          return (
            <div
              key={opportunity.id}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {getProjectStatusBadge(opportunity.status, t)}
                  <Badge variant="outline" className="text-xs">
                    {t("partner.dashboardPage.recentOpportunities.applicantCount", {
                      count: opportunity.currentApplicants,
                    })}
                  </Badge>
                </div>
                <Link to={detailsPath} className="font-medium hover:underline line-clamp-1">
                  {title}
                </Link>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button variant="outline" size="sm" asChild>
                  <Link to={detailsPath}>{t("partner.dashboardPage.recentOpportunities.viewOpportunity")}</Link>
                </Button>
                {opportunity.currentApplicants > 0 ? (
                  <Button size="sm" asChild>
                    <Link to={applicationsPath}>
                      <FileText className="h-4 w-4 mr-2" />
                      {t("partner.dashboardPage.recentOpportunities.viewApplicants")}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
