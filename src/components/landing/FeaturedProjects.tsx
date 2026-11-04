import { Button } from "@/components/ui/button";
import ProjectCard from "./ProjectCard";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFeaturedOpportunities } from "@/hooks/useOpportunities";
import { localizeOpportunityFields } from "@/lib/localizedContent";
import { ProjectCardSkeletonGrid } from "@/components/ui/skeletons";

const FeaturedProjects = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("landing");
  const { data: featuredOpportunities, isLoading } = useFeaturedOpportunities();

  const opportunities = featuredOpportunities?.slice(0, 3) ?? [];
  const hasRealProjects = opportunities.length > 0;

  // Hide only when DB has no open opportunities (featured preferred, else latest).
  if (!isLoading && !hasRealProjects) return null;

  return (
    <section className="py-20 md:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            {t("featuredProjects.title")}{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              {t("featuredProjects.titleHighlight")}
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            {t("featuredProjects.subtitle")}
          </p>
        </div>

        {isLoading ? (
          <ProjectCardSkeletonGrid count={3} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {opportunities.map((opportunity) => {
              const localized = localizeOpportunityFields(opportunity, i18n.language);
              return (
                <ProjectCard
                  key={opportunity.id}
                  id={localized.id}
                  title={localized.title}
                  description={localized.description}
                  sector={opportunity.tags?.[0]?.name || "Uncategorized"}
                  location={opportunity.location}
                  fundingAmount={opportunity.fundingAmount}
                  deadline={opportunity.deadline}
                  currentApplicants={opportunity.currentApplicants}
                  status={localized.status}
                />
              );
            })}
          </div>
        )}

        <div className="text-center">
          <Button
            variant="outline"
            size="lg"
            className="group"
            onClick={() => navigate("/opportunities")}
          >
            {t("featuredProjects.viewAll")}
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedProjects;
