import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  MapPin,
  DollarSign,
  Users,
  ArrowLeft,
  Clock,
  CheckCircle,
  FileText,
  Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ProjectDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: project, isLoading, error } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      if (!id) throw new Error("Project ID is required");
      
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", parseInt(id))
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-success text-success-foreground";
      case "closing-soon":
        return "bg-warning text-warning-foreground";
      case "closed":
        return "bg-muted text-muted-foreground";
      case "new":
        return "bg-blue-500 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "open":
        return "Open";
      case "closing-soon":
        return "Closing Soon";
      case "closed":
        return "Closed";
      case "new":
        return "New";
      default:
        return "Unknown";
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const isDisabled = project?.status === "closed";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-8" />
          <div className="grid gap-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-destructive mb-4">
                {error instanceof Error ? error.message : "Project not found"}
              </p>
              <Button onClick={() => navigate("/projects")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Projects
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate("/projects")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Badge variant="secondary" className="text-sm">
              {project.category}
            </Badge>
            <Badge className={getStatusColor(project.status)}>
              {getStatusText(project.status)}
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {project.title}
          </h1>
          <p className="text-xl text-muted-foreground">{project.description}</p>
        </div>

        {/* Key Details Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm">Funding</span>
              </div>
              <p className="font-semibold text-lg">{project.funding_amount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">Location</span>
              </div>
              <p className="font-semibold text-lg">{project.location}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Deadline</span>
              </div>
              <p className="font-semibold text-lg">{formatDate(project.deadline)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span className="text-sm">Applicants</span>
              </div>
              <p className="font-semibold text-lg">
                {project.current_applicants || 0}
                {project.max_applicants && ` / ${project.max_applicants}`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Requirements */}
        {project.requirements && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Requirements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                {project.requirements}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Eligibility Criteria */}
        {project.eligibility_criteria && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Eligibility Criteria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                {project.eligibility_criteria}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Application Fee */}
        {project.application_fee && Number(project.application_fee) > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Application Fee
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">
                ${Number(project.application_fee).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                This fee is required to submit your application.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Apply CTA */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold mb-2">
                  {isDisabled
                    ? "Applications are closed"
                    : "Ready to apply?"}
                </h3>
                <p className="text-muted-foreground">
                  {isDisabled
                    ? "This opportunity is no longer accepting applications."
                    : "Submit your application and take the first step towards funding your project."}
                </p>
              </div>
              <Button
                variant="hero"
                size="lg"
                disabled={isDisabled}
                onClick={() => navigate(`/application-form/${project.id}`)}
                className="whitespace-nowrap"
              >
                {isDisabled ? "Application Closed" : "Apply Now"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default ProjectDetails;
