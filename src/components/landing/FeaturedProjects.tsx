import { Button } from "@/components/ui/button";
import ProjectCard from "./ProjectCard";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFeaturedProjects } from "@/hooks/useProjects";
import { ProjectCardSkeletonGrid } from "@/components/ui/skeletons";

const FeaturedProjects = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('landing');
  const { data: featuredProjects, isLoading } = useFeaturedProjects();

  // Fallback mock data when no featured projects exist
  const fallbackProjects = [
    {
      id: "1",
      title: "AgriTech Innovation Fund",
      description: "Supporting agricultural technology startups across East Africa. Focus on sustainable farming solutions, crop monitoring systems, and supply chain optimization.",
      sector: "Agriculture",
      country: "Kenya",
      fundingAmount: "Up to $50K",
      deadline: "Dec 31, 2024",
      applicants: 45,
      status: "open" as const
    },
    {
      id: "2",
      title: "Women in Tech Accelerator",
      description: "Empowering female entrepreneurs in the technology sector. Providing mentorship, funding, and networking opportunities for women-led startups.",
      sector: "Technology",
      country: "Nigeria",
      fundingAmount: "Up to $25K",
      deadline: "Jan 15, 2025",
      applicants: 78,
      status: "open" as const
    },
    {
      id: "3",
      title: "Clean Energy Initiative",
      description: "Funding renewable energy projects and clean technology solutions. Solar, wind, and biogas projects that serve underserved communities.",
      sector: "Energy",
      country: "Ghana",
      fundingAmount: "Up to $100K",
      deadline: "Nov 30, 2024",
      applicants: 23,
      status: "closing-soon" as const
    },
  ];

  const hasRealProjects = featuredProjects && featuredProjects.length > 0;

  return (
    <section className="py-20 md:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            {t('featuredProjects.title')} <span className="bg-gradient-primary bg-clip-text text-transparent">{t('featuredProjects.titleHighlight')}</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            {t('featuredProjects.subtitle')}
          </p>
        </div>

        {isLoading ? (
          <ProjectCardSkeletonGrid count={3} />
        ) : hasRealProjects ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {featuredProjects.slice(0, 3).map((project) => (
              <ProjectCard
                key={project.id}
                id={project.id}
                title={project.title}
                description={project.description}
                category={project.category}
                location={project.location}
                fundingAmount={project.fundingAmount}
                deadline={project.deadline}
                currentApplicants={project.currentApplicants}
                status={project.status}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {fallbackProjects.map((project) => (
              <ProjectCard key={project.id} {...project} />
            ))}
          </div>
        )}

        <div className="text-center">
          <Button 
            variant="outline" 
            size="lg" 
            className="group"
            onClick={() => navigate("/projects")}
          >
            {t('featuredProjects.viewAll')}
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedProjects;
