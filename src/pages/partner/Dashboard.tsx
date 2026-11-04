import { useState, useEffect, useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { FolderKanban, FileText, Clock, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

import { useNavigate } from "react-router-dom";

import { useTranslation } from "react-i18next";

import { usePartnerStats } from "@/hooks/usePartnerStats";

import { usePartnerOrg } from "@/hooks/usePartnerOrg";

import { PartnerSetupWizard } from "@/components/partner/PartnerSetupWizard";

import { PartnerOnboardingChecklist } from "@/components/partner/PartnerOnboardingChecklist";

import { PartnerOrgRequiredAlert } from "@/components/partner/PartnerOrgRequiredAlert";

import { PartnerCreateOpportunityButton } from "@/components/partner/PartnerCreateOpportunityButton";

import { PartnerRecentOpportunities } from "@/components/partner/PartnerRecentOpportunities";

import { InAppTip } from "@/components/onboarding/InAppTip";

import { usePartnerOrgLinked } from "@/hooks/usePartnerOrg";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { Button } from "@/components/ui/button";

import { Skeleton } from "@/components/ui/skeleton";



const PartnerDashboard = () => {

  const navigate = useNavigate();

  const { t } = useTranslation(["dashboard", "common"]);

  const { data: stats, isLoading, isError, error, refetch } = usePartnerStats();

  const { data: partnerOrg, isLoading: isLoadingOrg } = usePartnerOrg();

  const { isLinked } = usePartnerOrgLinked();

  const [showWizard, setShowWizard] = useState(false);



  useEffect(() => {

    if (isLoadingOrg) return;

    if (partnerOrg && !partnerOrg.onboarding_dismissed_at && !partnerOrg.description) {

      setShowWizard(true);

    }

  }, [partnerOrg, isLoadingOrg]);



  const statCards = useMemo(

    () => [

      { title: t("dashboard:partner.dashboardPage.stats.totalOpportunities"), value: stats?.totalOpportunities ?? 0, icon: FolderKanban, color: "text-primary" },

      { title: t("dashboard:partner.dashboardPage.stats.activeOpportunities"), value: stats?.activeOpportunities ?? 0, icon: Clock, color: "text-amber-500" },

      { title: t("dashboard:partner.dashboardPage.stats.totalApplications"), value: stats?.totalApplications ?? 0, icon: FileText, color: "text-blue-500" },

      { title: t("dashboard:partner.dashboardPage.stats.approved"), value: stats?.approvedApplications ?? 0, icon: CheckCircle, color: "text-emerald-500" },

    ],

    [stats, t]

  );



  const allZero = !isLoading && !isError && statCards.every((s) => s.value === 0);



  return (

    <div className="space-y-6">

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-2xl font-bold">{t("dashboard:partner.pages.dashboard")}</h1>

          <p className="text-muted-foreground">{t("dashboard:partner.dashboardPage.subtitle")}</p>

        </div>

        <PartnerCreateOpportunityButton label={t("dashboard:opportunities.page.create")} />

      </div>



      {isLoadingOrg ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : (
        <>
          <PartnerOrgRequiredAlert />
          <PartnerOnboardingChecklist />
        </>
      )}



      {isError && (

        <Alert variant="destructive">

          <AlertCircle className="h-4 w-4" />

          <AlertTitle>{t("dashboard:partner.dashboardPage.statsError.title")}</AlertTitle>

          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <span>

              {error instanceof Error

                ? error.message

                : t("dashboard:partner.dashboardPage.statsError.description")}

            </span>

            <Button variant="outline" size="sm" onClick={() => refetch()}>

              <RefreshCw className="h-4 w-4 mr-2" />

              {t("dashboard:partner.dashboardPage.statsError.retry")}

            </Button>

          </AlertDescription>

        </Alert>

      )}



      {allZero && (

        <InAppTip

          id="partner-dashboard-zero-stats"

          title={t("dashboard:partner.dashboardPage.zeroStatsTip.title")}

          description={t("dashboard:partner.dashboardPage.zeroStatsTip.description")}

          type="info"

          action={

            isLinked

              ? {

                  label: t("dashboard:partner.dashboardPage.zeroStatsTip.action"),

                  onClick: () => navigate("/partner/opportunities/new"),

                }

              : undefined

          }

        />

      )}



      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {statCards.map((stat) => {

          const Icon = stat.icon;

          return (

            <Card key={stat.title}>

              <CardHeader className="flex flex-row items-center justify-between pb-2">

                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>

                <Icon className={`h-4 w-4 ${stat.color}`} />

              </CardHeader>

              <CardContent>

                <div className="text-2xl font-bold">

                  {isLoading ? "..." : isError ? "—" : stat.value}

                </div>

              </CardContent>

            </Card>

          );

        })}

      </div>



      <PartnerRecentOpportunities />



      <PartnerSetupWizard open={showWizard} onOpenChange={setShowWizard} />

    </div>

  );

};



export default PartnerDashboard;

