import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { useOpportunityDetails } from "@/hooks/useOpportunityDetails";
import { ProjectInfo } from "@/components/projects/ProjectInfo";
import { ProjectRequirements } from "@/components/projects/ProjectRequirements";
import { OpportunityDocumentsCard } from "@/components/projects/OpportunityDocumentsCard";
import { ProjectApplicationSidebar } from "@/components/projects/ProjectApplicationSidebar";
import { SEO } from "@/components/seo/SEO";
import { StructuredData } from "@/components/seo/StructuredData";
import { getSiteUrl, getImageUrl, truncateDescription } from "@/utils/seo";

import { useLocalizedOpportunity } from "@/lib/localizedContent";

const ProjectDetails = () => {
  const { t } = useTranslation("landing");
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    opportunity,
    isLoading,
    error,
    draft,
    existingApplication,
    hasSubmittedApplication,
    hasApprovedApplication,
  } = useOpportunityDetails(id);
  const localizedOpportunity = useLocalizedOpportunity(opportunity ?? undefined);

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

  if (error || !opportunity) {
    // Log error details for debugging
    if (error) {
      console.error("Opportunity fetch error:", {
        error,
        id,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
    }
    
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">{t("seo.opportunityNotFound.title")}</h1>
            <p className="text-muted-foreground mb-4">{t("seo.opportunityNotFound.description")}</p>
            {error && (
              <p className="text-sm text-muted-foreground mb-4">
                ID: {id} | Check the browser console for more details.
              </p>
            )}
            <Button onClick={() => navigate("/opportunities")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("seo.opportunityNotFound.back")}
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const projectUrl = `${getSiteUrl()}/opportunities/${opportunity.id}`;
  const projectImage = opportunity.imageUrl ? getImageUrl(opportunity.imageUrl) : undefined;
  const projectDescription = truncateDescription(localizedOpportunity?.description || localizedOpportunity?.title || opportunity.description || opportunity.title);

  return (
    <>
      <SEO
        title={localizedOpportunity?.title || opportunity.title}
        description={projectDescription}
        // Keywords are optional - modern search engines ignore meta keywords
        // The description and structured data provide better SEO value
        image={projectImage}
        url={projectUrl}
        type="website"
        canonical={projectUrl}
      />
      {opportunity && (
        <StructuredData
          type="Project"
          data={{
            name: opportunity.title,
            description: opportunity.description || opportunity.title,
            image: projectImage,
            url: projectUrl,
            fundingAmount: opportunity.fundingAmount,
            location: opportunity.location ? { name: opportunity.location } : undefined,
            startDate: opportunity.createdAt,
            endDate: opportunity.deadline,
            sector: opportunity.sector || opportunity.tags?.[0]?.name || "Uncategorized",
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
          onClick={() => navigate("/opportunities")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("seo.opportunityNotFound.back")}
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Project Details */}
          <div className="lg:col-span-2 space-y-6">
            <ProjectInfo project={opportunity} />
            <OpportunityDocumentsCard opportunityId={opportunity.id} />
            <ProjectRequirements project={opportunity} />
          </div>

          {/* Application Sidebar */}
          <div>
            <ProjectApplicationSidebar
              project={opportunity}
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








