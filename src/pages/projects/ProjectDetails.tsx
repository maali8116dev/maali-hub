import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, DollarSign, Calendar, FileText, Target, Edit, CheckCircle2, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectDraft } from "@/hooks/useUserDrafts";
import { getProjectDisplayStatus } from "@/lib/projectAvailability";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SEO } from "@/components/seo/SEO";
import { StructuredData } from "@/components/seo/StructuredData";
import { getSiteUrl, getImageUrl, truncateDescription } from "@/utils/seo";
import { isProjectOpen } from "@/lib/projectAvailability";

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: project, isLoading, error } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      if (!id) throw new Error("Project ID is required");
      
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          categories:category_id(name)
        `)
        .eq("id", parseInt(id))
        .single();

      if (error) throw error;
      // Add category property from joined table
      return {
        ...data,
        category: (data as any).categories?.name || 'Uncategorized'
      };
    },
    enabled: !!id,
  });

  // Check if user has a draft for this project
  const { data: draft } = useProjectDraft(id ? parseInt(id) : undefined);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "New":
        return "bg-blue-500 text-white";
      case "Closing Soon":
        return "bg-warning text-warning-foreground";
      case "Open":
        return "bg-success text-success-foreground";
      case "Closed":
        return "bg-muted text-muted-foreground";
      case "Archived":
        return "bg-slate-500 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusText = (status: string) => status;

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-10 w-32 mb-6" />
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-24 mb-4" />
                  <Skeleton className="h-8 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full mb-6" />
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            </div>
            <div>
              <Skeleton className="h-48 w-full" />
            </div>
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
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Project Not Found</h1>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "The project you're looking for doesn't exist."}
            </p>
            <Button onClick={() => navigate("/projects")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const isDisabled = !isProjectOpen(project.status, project.deadline);

  const projectUrl = `${getSiteUrl()}/projects/${project.id}`;
  const projectImage = project.image_url ? getImageUrl(project.image_url) : undefined;
  const projectDescription = truncateDescription(project.description || project.title);

  return (
    <>
      <SEO
        title={project.title}
        description={projectDescription}
        // Keywords are optional - modern search engines ignore meta keywords
        // The description and structured data provide better SEO value
        image={projectImage}
        url={projectUrl}
        type="website"
        canonical={projectUrl}
      />
      {project && (
        <StructuredData
          type="Project"
          data={{
            name: project.title,
            description: project.description || project.title,
            image: projectImage,
            url: projectUrl,
            fundingAmount: project.funding_amount,
            location: project.location ? { name: project.location } : undefined,
            startDate: project.created_at,
            endDate: project.deadline,
            category: project.category,
          }}
          id="project-schema"
        />
      )}
      <div className="min-h-screen bg-background">
        <Navigation />
      <main className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate("/projects")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Project Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start mb-4">
                  <Badge variant="secondary">{project.category}</Badge>
                  <Badge
                    className={getStatusColor(
                      getProjectDisplayStatus(
                        project.status,
                        project.deadline,
                        project.created_at,
                      ),
                    )}
                  >
                    {getStatusText(
                      getProjectDisplayStatus(
                        project.status,
                        project.deadline,
                        project.created_at,
                      ),
                    )}
                  </Badge>
                </div>
                <CardTitle className="text-2xl">{project.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Project Image */}
                {project.image_url && (
                  <div className="mb-6">
                    <img
                      src={project.image_url}
                      alt={project.title}
                      className="w-full h-64 object-cover rounded-lg"
                    />
                  </div>
                )}
                <p className="text-muted-foreground mb-6">
                  {project.description}
                </p>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <span>{project.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <span>{project.funding_amount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <span>Deadline: {formatDate(project.deadline)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Requirements */}
            {project.requirements && (
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    Requirements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {project.requirements.split('\n').filter(line => line.trim()).map((item, index) => {
                      const cleanedItem = item.replace(/^[-•]\s*/, '').trim();
                      const isNumbered = /^\d+[\.\)]\s/.test(cleanedItem);
                      const displayText = cleanedItem.replace(/^\d+[\.\)]\s/, '');
                      
                      return (
                        <div 
                          key={index} 
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            {isNumbered ? (
                              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                                {cleanedItem.match(/^\d+/)?.[0]}
                              </div>
                            ) : (
                              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-foreground leading-relaxed flex-1 pt-0.5">
                            {displayText || cleanedItem}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Eligibility Criteria */}
            {project.eligibility_criteria && (
              <Card className="border-l-4 border-l-success">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <div className="p-2 bg-success/10 rounded-lg">
                      <Target className="h-5 w-5 text-success" />
                    </div>
                    Eligibility Criteria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {project.eligibility_criteria.split('\n').filter(line => line.trim()).map((item, index) => {
                      const cleanedItem = item.replace(/^[-•]\s*/, '').trim();
                      const isNumbered = /^\d+[\.\)]\s/.test(cleanedItem);
                      const displayText = cleanedItem.replace(/^\d+[\.\)]\s/, '');
                      
                      return (
                        <div 
                          key={index} 
                          className="flex items-start gap-3 p-3 rounded-lg bg-success/5 hover:bg-success/10 transition-colors border border-success/10"
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            {isNumbered ? (
                              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-success/20 text-success text-sm font-semibold">
                                {cleanedItem.match(/^\d+/)?.[0]}
                              </div>
                            ) : (
                              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-foreground leading-relaxed flex-1 pt-0.5">
                            {displayText || cleanedItem}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Application Sidebar */}
          <div>
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle>
                  {isDisabled ? "Applications Closed" : "Start Your Application"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Login Banner */}
                {!user && !isDisabled && (
                  <Alert className="mb-4 border-blue-500/50 bg-blue-500/5">
                    <LogIn className="h-4 w-4 text-blue-500" />
                    <AlertTitle className="text-blue-800 dark:text-blue-200">
                      Login Required
                    </AlertTitle>
                    <AlertDescription className="text-blue-700 dark:text-blue-300">
                      Please log in or create an account to apply for this opportunity.
                    </AlertDescription>
                  </Alert>
                )}
                {draft ? (
                  <>
                    <div className="bg-muted/50 rounded-lg p-3 mb-4">
                      <p className="text-sm font-medium text-foreground mb-1">
                        You have a saved draft
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last saved: {new Date(draft.updated_at).toLocaleDateString()} at{" "}
                        {new Date(draft.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Button 
                      className="w-full mb-2" 
                      variant="hero"
                      size="lg"
                      disabled={isDisabled}
                      onClick={() => {
                        if (!user) {
                          toast({
                            title: "Login Required",
                            description: "Please log in or create an account to continue your application.",
                            variant: "default",
                          });
                          navigate("/auth", { state: { from: { pathname: `/projects/${id}/apply` } } });
                        } else {
                          navigate(`/projects/${id}/apply`);
                        }
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Continue Draft
                    </Button>
                    <Button 
                      className="w-full" 
                      variant="outline"
                      size="lg"
                      disabled={isDisabled}
                      onClick={() => {
                        if (!user) {
                          toast({
                            title: "Login Required",
                            description: "Please log in or create an account to start a new application.",
                            variant: "default",
                          });
                          navigate("/auth", { state: { from: { pathname: `/projects/${id}/apply?new=true` } } });
                        } else {
                          navigate(`/projects/${id}/apply?new=true`);
                        }
                      }}
                    >
                      Start New Application
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">
                      {isDisabled 
                        ? "This opportunity is no longer accepting applications."
                        : "Ready to apply for this grant? Click below to begin the application process."
                      }
                    </p>
                    <Button 
                      className="w-full" 
                      variant="hero"
                      size="lg"
                      disabled={isDisabled}
                      onClick={() => {
                        if (!user) {
                          toast({
                            title: "Login Required",
                            description: "Please log in or create an account to apply for this opportunity.",
                            variant: "default",
                          });
                          navigate("/auth", { state: { from: { pathname: `/projects/${id}/apply` } } });
                        } else {
                          navigate(`/projects/${id}/apply`);
                        }
                      }}
                    >
                      {isDisabled ? "Application Closed" : "Begin Application"}
                    </Button>
                  </>
                )}

                {project.application_fee && Number(project.application_fee) > 0 && (
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    Application fee: ${Number(project.application_fee).toFixed(2)} (processed at submission)
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
    </>
  );
};

export default ProjectDetails;
