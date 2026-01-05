import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, FileText, Calendar, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

interface Application {
  id: string;
  projectTitle: string;
  status: "pending" | "approved" | "rejected" | "draft";
  submittedAt: string;
  sector: string;
  country: string;
  fundingAmount: string;
}

const Applications = () => {
  // Mock data - replace with API calls when backend is ready
  const [applications] = useState<Application[]>([
    {
      id: "1",
      projectTitle: "AgriTech Innovation Fund",
      status: "pending",
      submittedAt: "2024-01-15",
      sector: "Agriculture",
      country: "Kenya",
      fundingAmount: "Up to $50K",
    },
    {
      id: "2",
      projectTitle: "Women in Tech Accelerator",
      status: "approved",
      submittedAt: "2024-01-10",
      sector: "Technology",
      country: "Nigeria",
      fundingAmount: "Up to $25K",
    },
    {
      id: "3",
      projectTitle: "Clean Energy Initiative",
      status: "pending",
      submittedAt: "2024-01-08",
      sector: "Energy",
      country: "Ghana",
      fundingAmount: "Up to $100K",
    },
    {
      id: "4",
      projectTitle: "Healthcare Innovation Lab",
      status: "rejected",
      submittedAt: "2023-12-20",
      sector: "Healthcare",
      country: "South Africa",
      fundingAmount: "Up to $75K",
    },
    {
      id: "5",
      projectTitle: "Fintech for Financial Inclusion",
      status: "draft",
      submittedAt: "2024-01-20",
      sector: "Fintech",
      country: "Rwanda",
      fundingAmount: "Up to $40K",
    },
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.projectTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.sector.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: "bg-warning/10 text-warning border-warning/20",
      approved: "bg-success/10 text-success border-success/20",
      rejected: "bg-destructive/10 text-destructive border-destructive/20",
      draft: "bg-muted text-muted-foreground border-border",
    };
    return styles[status as keyof typeof styles] || styles.pending;
  };

  const statusCounts = {
    all: applications.length,
    pending: applications.filter((a) => a.status === "pending").length,
    approved: applications.filter((a) => a.status === "approved").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
    draft: applications.filter((a) => a.status === "draft").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Applications</h1>
        <p className="text-muted-foreground mt-2">
          Track and manage your funding applications
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search applications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              {[
                { value: "all", label: "All" },
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "draft", label: "Draft" },
              ].map((filter) => (
                <Button
                  key={filter.value}
                  variant={statusFilter === filter.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(filter.value)}
                >
                  {filter.label} ({statusCounts[filter.value as keyof typeof statusCounts]})
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applications List */}
      {filteredApplications.length > 0 ? (
        <div className="space-y-4">
          {filteredApplications.map((app) => (
            <Card key={app.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2">{app.projectTitle}</CardTitle>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        <span>{app.sector}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span>{app.country}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Submitted {new Date(app.submittedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <Badge className={getStatusBadge(app.status)}>
                    {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Funding Amount
                    </p>
                    <p className="text-lg font-semibold">{app.fundingAmount}</p>
                  </div>
                  <div className="flex gap-2">
                    {app.status === "draft" ? (
                      <Link to={`/application/${app.id}`}>
                        <Button variant="outline">Continue Application</Button>
                      </Link>
                    ) : (
                      <Link to={`/application/${app.id}`}>
                        <Button variant="outline">View Details</Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No applications found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Start by browsing available opportunities"}
            </p>
            {!searchQuery && statusFilter === "all" && (
              <Link to="/projects">
                <Button variant="hero">Browse Opportunities</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Applications;

