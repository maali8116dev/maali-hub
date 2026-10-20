import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plug, BookOpen } from "lucide-react";
import { PartnerOrgRequiredAlert } from "@/components/partner/PartnerOrgRequiredAlert";
import { PartnerApiPanel } from "@/components/partner/PartnerApiPanel";
import { usePartnerOrg, useIsPartnerOrgAdmin } from "@/hooks/usePartnerOrg";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const PartnerApi = () => {
  const { t } = useTranslation("dashboard");
  const { data: partnerOrg, isLoading } = usePartnerOrg();
  const isOrgAdmin = useIsPartnerOrgAdmin();

  if (isLoading) {
    return <p className="text-muted-foreground">{t("partner.apiPage.loading")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Plug className="h-6 w-6" />
            {t("partner.pages.api")}
          </h1>
          <p className="text-muted-foreground">{t("partner.apiPage.subtitle")}</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/partner/api/docs">
            <BookOpen className="h-4 w-4 mr-2" />
            {t("partner.apiDocs.viewDocs")}
          </Link>
        </Button>
      </div>

      <PartnerOrgRequiredAlert />

      {!isOrgAdmin && partnerOrg ? (
        <Alert>
          <AlertTitle>{t("partner.apiPage.readOnlyTitle")}</AlertTitle>
          <AlertDescription>{t("partner.apiPage.readOnlyDescription")}</AlertDescription>
        </Alert>
      ) : null}

      {partnerOrg ? (
        <PartnerApiPanel partnerOrgId={partnerOrg.id} canManage={isOrgAdmin} />
      ) : null}
    </div>
  );
};

export default PartnerApi;
