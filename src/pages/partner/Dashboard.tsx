import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderKanban, FileText, Clock, CheckCircle, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePartnerStats } from "@/hooks/usePartnerStats";

const PartnerDashboard = () => {
  const navigate = useNavigate();
  const { data: stats, isLoading } = usePartnerStats();

  const statCards = [
    { title: "Total Projects", value: stats?.totalProjects ?? 0, icon: FolderKanban, color: "text-primary" },
    { title: "Active Projects", value: stats?.activeProjects ?? 0, icon: Clock, color: "text-amber-500" },
    { title: "Total Applications", value: stats?.totalApplications ?? 0, icon: FileText, color: "text-blue-500" },
    { title: "Approved", value: stats?.approvedApplications ?? 0, icon: CheckCircle, color: "text-emerald-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Partner Dashboard</h1>
          <p className="text-muted-foreground">Manage your projects and track applications</p>
        </div>
        <Button onClick={() => navigate("/partner/projects/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

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
    </div>
  );
};

export default PartnerDashboard;
