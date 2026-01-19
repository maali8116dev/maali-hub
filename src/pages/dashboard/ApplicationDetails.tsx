import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  FileText, 
  Calendar, 
  MapPin, 
  Building2, 
  Mail, 
  Phone, 
  DollarSign,
  Users,
  ExternalLink
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const ApplicationDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: application, isLoading, error } = useQuery({
    queryKey: ["application", id],
    queryFn: async () => {
      if (!id) throw new Error("Application ID is required");

      const { data: app, error: appError } = await supabase
        .from("applications")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (appError) throw appError;
      if (!app) throw new Error("Application not found");

      // Fetch project details
      const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", app.project_id)
        .maybeSingle();

      return {
        ...app,
        project,
      };
    },
    enabled: !!id,
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-warning/10 text-warning border-warning/20",
      under_review: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      approved: "bg-success/10 text-success border-success/20",
      rejected: "bg-destructive/10 text-destructive border-destructive/20",
      draft: "bg-muted text-muted-foreground border-border",
    };
    return styles[status] || styles.pending;
  };

  const formatStatus = (status: string) => {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Application Not Found</h2>
              <p className="text-muted-foreground mb-4">
                The application you're looking for doesn't exist or you don't have access to it.
              </p>
              <Button onClick={() => navigate("/dashboard/applications")}>
                View All Applications
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {application.project?.title || "Application Details"}
            </h1>
            <p className="text-muted-foreground">
              Application ID: {application.id.slice(0, 8)}...
            </p>
          </div>
        </div>
        <Badge className={getStatusBadge(application.status || "pending")}>
          {formatStatus(application.status || "pending")}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Application Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Application Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Company Name</p>
                  <p className="font-medium">{application.company_name || "Not provided"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Contact Email</p>
                  <p className="font-medium">{application.contact_email || "Not provided"}</p>
                </div>
              </div>

              {application.contact_phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Contact Phone</p>
                    <p className="font-medium">{application.contact_phone}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Location</p>
                  <p className="font-medium">{application.location || "Not provided"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Funding Requested</p>
                  <p className="font-medium">{application.funding_amount_requested || "Not specified"}</p>
                </div>
              </div>

              {application.team_size && (
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Team Size</p>
                    <p className="font-medium">{application.team_size} members</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Project Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Project Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {application.project ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Project Title</p>
                  <p className="font-medium">{application.project.title}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Category</p>
                  <Badge variant="outline">{application.project.category}</Badge>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Funding Amount</p>
                  <p className="font-medium">{application.project.funding_amount}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Location</p>
                  <p className="font-medium">{application.project.location}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Deadline</p>
                  <p className="font-medium">
                    {new Date(application.project.deadline).toLocaleDateString()}
                  </p>
                </div>

                <Separator />

                <Link to={`/projects/${application.project_id}`}>
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Project Details
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="text-muted-foreground">Project information unavailable</p>
            )}
          </CardContent>
        </Card>

        {/* Project Description */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Project Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {application.project_description || "No description provided"}
            </p>
          </CardContent>
        </Card>

        {/* Business Plan */}
        {application.business_plan && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Business Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {application.business_plan}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-8">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Submitted</p>
                <p className="font-medium">
                  {new Date(application.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                <p className="font-medium">
                  {new Date(application.updated_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Payment Status</p>
                <Badge variant={application.application_fee_paid ? "default" : "secondary"}>
                  {application.application_fee_paid ? "Paid" : "Unpaid"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Button variant="outline" onClick={() => navigate("/dashboard/applications")}>
          Back to Applications
        </Button>
        {application.status === "draft" && (
          <Link to={`/projects/${application.project_id}/apply`}>
            <Button>Continue Application</Button>
          </Link>
        )}
      </div>
    </div>
  );
};

export default ApplicationDetails;
