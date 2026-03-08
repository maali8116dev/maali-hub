import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderKanban, FileText, Clock, CheckCircle, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePartnerStats } from "@/hooks/usePartnerStats";
import { usePartnerOrg } from "@/hooks/usePartnerOrg";
import { PartnerSetupWizard } from "@/components/partner/PartnerSetupWizard";
import { PartnerOnboardingChecklist } from "@/components/partner/PartnerOnboardingChecklist";
import { InAppTip } from "@/components/onboarding/InAppTip";

const PartnerDashboard = () => {
  const navigate = useNavigate();
  const { data: stats, isLoading } = usePartnerStats();
  const { data: partnerOrg, isLoading: isLoadingOrg } = usePartnerOrg();
  const [showWizard, setShowWizard] = useState(false);

  // Show wizard on first login if org profile is incomplete
  useEffect(() => {
    if (isLoadingOrg) return;
    const dismissed = localStorage.getItem("partner-wizard-dismissed") === "true";
    if (!dismissed && partnerOrg && !partnerOrg.description) {
      setShowWizard(true);
    }
  }, [partnerOrg, isLoadingOrg]);

  const statCards = [
    { title: "Total Opportunities", value: stats?.totalOpportunities ?? 0, icon: FolderKanban, color: "text-primary" },
    { title: "Active Opportunities", value: stats?.activeOpportunities ?? 0, icon: Clock, color: "text-amber-500" },
    { title: "Total Applications", value: stats?.totalApplications ?? 0, icon: FileText, color: "text-blue-500" },
    { title: "Approved", value: stats?.approvedApplications ?? 0, icon: CheckCircle, color: "text-emerald-500" },
  ];

  const allZero = !isLoading && statCards.every((s) => s.value === 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Partner Dashboard</h1>
          <p className="text-muted-foreground">Manage your opportunities and track applications</p>
        </div>
        <Button onClick={() => navigate("/partner/opportunities/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Opportunity
        </Button>
      </div>

      {/* Onboarding Checklist */}
      <PartnerOnboardingChecklist />

      {/* Contextual tip for zero stats */}
      {allZero && (
        <InAppTip
          id="partner-dashboard-zero-stats"
          title="Your dashboard metrics"
          description="These cards will show your opportunity and application counts once you create your first opportunity and start receiving applications."
          type="info"
          action={{
            label: "Create Opportunity",
            onClick: () => navigate("/partner/opportunities/new"),
          }}
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
                  {isLoading ? "..." : stat.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Setup Wizard */}
      <PartnerSetupWizard open={showWizard} onOpenChange={setShowWizard} />
    </div>
  );
};

export default PartnerDashboard;
