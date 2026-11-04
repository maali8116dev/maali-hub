import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
import { PartnerOrgRequiredAlert } from "@/components/partner/PartnerOrgRequiredAlert";
import { PartnerTeamPanel } from "@/components/partner/PartnerTeamPanel";
import { usePartnerOrg, useIsPartnerOrgAdmin } from "@/hooks/usePartnerOrg";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const PartnerTeam = () => {
  const { t } = useTranslation("dashboard");
  const { data: partnerOrg, isLoading } = usePartnerOrg();
  const isOrgAdmin = useIsPartnerOrgAdmin();

  if (isLoading) {
    return <p className="text-muted-foreground">{t("partner.teamPage.loading")}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          {t("partner.pages.team")}
        </h1>
        <p className="text-muted-foreground">{t("partner.teamPage.subtitle")}</p>
      </div>

      <PartnerOrgRequiredAlert />

      {!isOrgAdmin && partnerOrg ? (
        <Alert>
          <AlertTitle>{t("partner.teamPage.readOnlyTitle")}</AlertTitle>
          <AlertDescription>{t("partner.teamPage.readOnlyDescription")}</AlertDescription>
        </Alert>
      ) : null}

      {partnerOrg ? (
        <PartnerTeamPanel
          partnerOrgId={partnerOrg.id}
          partnerOrgName={partnerOrg.name}
          canManage={isOrgAdmin}
        />
      ) : null}
    </div>
  );
};

export default PartnerTeam;
