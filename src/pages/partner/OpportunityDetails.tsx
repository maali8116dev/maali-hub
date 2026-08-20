import { useParams, useNavigate, Link } from "react-router-dom";
import DOMPurify from "dompurify";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Edit,
  ExternalLink,
  FileText,
  MapPin,
  Users,
} from "lucide-react";
import { usePartnerOpportunity } from "@/hooks/usePartnerOpportunities";
import { useSectors } from "@/hooks/useSectors";
import { useLocalizedOpportunity } from "@/lib/localizedContent";
import { getProjectStatusBadge } from "@/lib/statusBadges";

function RichHtml({ html }: { html: string }) {
  return (
    <div
      className="text-muted-foreground [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  );
}

const PartnerOpportunityDetails = () => {
  const { t, i18n } = useTranslation("dashboard");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const opportunityId = id ? parseInt(id, 10) : undefined;

  const { data: opportunityRaw, isLoading, error } = usePartnerOpportunity(opportunityId);
  const opportunity = useLocalizedOpportunity(opportunityRaw);
  const { data: sectors = [] } = useSectors();

  const sectorName =
    sectors.find((sector) => sector.id === opportunity?.sectorId)?.name ??
    t("partner.opportunityDetailsPage.uncategorized");

  const formatDate = (value: string) => new Date(value).toLocaleDateString(i18n.language);

  const fundingLabel =
    opportunity?.fundingAmount &&
    [opportunity.currency, opportunity.fundingAmount].filter(Boolean).join(" ");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">{t("partner.opportunityDetailsPage.loading")}</p>
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/partner/opportunities")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("partner.opportunityDetailsPage.back")}
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {t("partner.opportunityDetailsPage.notFound")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={() => navigate("/partner/opportunities")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("partner.opportunityDetailsPage.back")}
        </Button>
        <div className="flex flex-wrap gap-2">
          <Link to={`/opportunities/${opportunity.id}`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              {t("partner.opportunityDetailsPage.viewPublic")}
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/partner/opportunities/${opportunity.id}/applications`)}
          >
            <FileText className="h-4 w-4 mr-2" />
            {t("partner.opportunityDetailsPage.viewApplications")}
          </Button>
          <Button size="sm" onClick={() => navigate(`/partner/opportunities/${opportunity.id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            {t("partner.opportunityDetailsPage.edit")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {getProjectStatusBadge(opportunity.status, t)}
                <Badge variant="outline">{sectorName}</Badge>
              </div>
              <CardTitle className="text-2xl">{opportunity.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <RichHtml html={opportunity.description || ""} />
            </CardContent>
          </Card>

          {(opportunity.requirements || opportunity.eligibilityCriteria) && (
            <Card>
              <CardHeader>
                <CardTitle>{t("partner.opportunityDetailsPage.requirementsTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {opportunity.requirements && (
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("partner.opportunityDetailsPage.requirements")}
                    </h4>
                    <RichHtml html={opportunity.requirements} />
                  </div>
                )}
                {opportunity.eligibilityCriteria && (
                  <div>
                    <h4 className="font-semibold mb-2">
                      {t("partner.opportunityDetailsPage.eligibility")}
                    </h4>
                    <RichHtml html={opportunity.eligibilityCriteria} />
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {opportunity.imageUrl && (
            <Card>
              <CardContent className="pt-6">
                <img
                  src={opportunity.imageUrl}
                  alt={opportunity.title}
                  className="w-full h-48 object-cover rounded-lg"
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t("partner.opportunityDetailsPage.sidebarTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {fundingLabel ? (
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("partner.opportunityDetailsPage.fundingAmount")}
                    </p>
                    <p className="font-semibold">{fundingLabel}</p>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("partner.opportunityDetailsPage.deadline")}
                  </p>
                  <p className="font-semibold">{formatDate(opportunity.deadline)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("partner.opportunityDetailsPage.location")}
                  </p>
                  <p className="font-semibold">
                    {[opportunity.location, opportunity.country].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("partner.opportunityDetailsPage.applicants")}
                  </p>
                  <p className="font-semibold">
                    {opportunity.currentApplicants || 0}
                    {opportunity.maxApplicants ? ` / ${opportunity.maxApplicants}` : ""}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("partner.opportunityDetailsPage.metadata")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  {t("partner.opportunityDetailsPage.opportunityId")}
                </span>
                <span className="font-mono">{opportunity.id}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t("partner.opportunityDetailsPage.created")}</span>
                <span>{formatDate(opportunity.createdAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PartnerOpportunityDetails;
