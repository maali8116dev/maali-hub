import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { usePartnerOpportunities } from "@/hooks/usePartnerOpportunities";
import { useSectors } from "@/hooks/useSectors";
import { InAppTip } from "@/components/onboarding/InAppTip";
import { DataTable } from "@/components/ui/data-table";
import { TableSkeleton } from "@/components/ui/skeletons";
import { useTranslation } from "react-i18next";
import {
  createOpportunityColumns,
  OPPORTUNITY_TABLE_HIDDEN_COLUMNS,
} from "@/components/opportunities/createOpportunityColumns";
import { PartnerOrgRequiredAlert } from "@/components/partner/PartnerOrgRequiredAlert";
import { PartnerCreateOpportunityButton } from "@/components/partner/PartnerCreateOpportunityButton";

const PartnerOpportunities = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("dashboard");
  const { data: opportunities = [], isLoading, refetch } = usePartnerOpportunities();
  const { data: sectors = [] } = useSectors();

  const tableData = useMemo(
    () =>
      opportunities.map((opp) => ({
        ...opp,
        sector: sectors.find((sector) => sector.id === opp.sectorId)?.name,
      })),
    [opportunities, sectors],
  );

  const columns = useMemo(
    () =>
      createOpportunityColumns({
        role: "partner",
        t,
        language: i18n.language,
        navigate,
      }),
    [t, i18n.language, navigate],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("opportunities.page.title")}</h1>
          <p className="text-muted-foreground">{t("opportunities.page.subtitle")}</p>
        </div>
        <PartnerCreateOpportunityButton label={t("opportunities.page.create")} />
      </div>

      <PartnerOrgRequiredAlert />

      {opportunities.length === 0 && isLoading ? (
        <Card>
          <CardContent className="p-0">
            <TableSkeleton rows={5} columns={6} />
          </CardContent>
        </Card>
      ) : opportunities.length === 0 ? (
        <div className="space-y-4">
          <InAppTip
            id="partner-empty-opportunities"
            title={t("opportunities.page.emptyTipTitle")}
            description={t("opportunities.page.emptyTipDescription")}
            type="tip"
            dismissible={false}
          />
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">{t("opportunities.page.emptyDescription")}</p>
              <PartnerCreateOpportunityButton label={t("opportunities.page.createFirst")} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <TableSkeleton rows={5} columns={6} />
            ) : (
              <DataTable
                columns={columns}
                data={tableData}
                searchKey="title"
                searchPlaceholder={t("opportunities.table.searchPlaceholder")}
                enableColumnVisibility
                initialColumnVisibility={OPPORTUNITY_TABLE_HIDDEN_COLUMNS}
                embedded
                onRefresh={async () => { await refetch(); }}
                isRefreshing={isLoading}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PartnerOpportunities;
