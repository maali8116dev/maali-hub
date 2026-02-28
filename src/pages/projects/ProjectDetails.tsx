import { useParams, useNavigate } from "react-router-dom";

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { useProjectDetails } from "@/hooks/useProjectDetails";
import { ProjectInfo } from "@/components/projects/ProjectInfo";
import { ProjectRequirements } from "@/components/projects/ProjectRequirements";
import { ProjectApplicationSidebar } from "@/components/projects/ProjectApplicationSidebar";
import { SEO } from "@/components/seo/SEO";
import { StructuredData } from "@/components/seo/StructuredData";
import { getSiteUrl, getImageUrl, truncateDescription } from "@/utils/seo";

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    project,
    isLoading,
    error,
    draft,
    existingApplication,
    hasSubmittedApplication,
    hasApprovedApplication,
  } = useProjectDetails(id);

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
            <ProjectInfo project={project} />
            <ProjectRequirements project={project} />
          </div>

          {/* Application Sidebar */}
          <div>
            <ProjectApplicationSidebar
              project={project}
              draft={draft}
              existingApplication={existingApplication}
              hasSubmittedApplication={hasSubmittedApplication}
              hasApprovedApplication={hasApprovedApplication}
            />
          </div>
        </div>
      </main>
      <Footer />
    </div>
    </>
  );
};

export default ProjectDetails;
