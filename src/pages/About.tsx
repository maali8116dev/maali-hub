import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Target, Users, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePublicPartners } from "@/hooks/usePartners";
import { PartnersCarousel } from "@/components/partners/PartnersCarousel";
import { Skeleton } from "@/components/ui/skeleton";

const About = () => {
  const { t } = useTranslation("landing");
  const { data: partners = [], isLoading: isLoadingPartners } = usePublicPartners();

  const values = [
    {
      icon: Heart,
      title: t("about.values.empowerment.title"),
      description: t("about.values.empowerment.description"),
    },
    {
      icon: Target,
      title: t("about.values.innovation.title"),
      description: t("about.values.innovation.description"),
    },
    {
      icon: Users,
      title: t("about.values.collaboration.title"),
      description: t("about.values.collaboration.description"),
    },
    {
      icon: Globe,
      title: t("about.values.impact.title"),
      description: t("about.values.impact.description"),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="text-center mb-12 sm:mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-hero bg-clip-text text-transparent mb-4 sm:mb-6">
            {t("about.title")}
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed px-4">
            {t("about.hero")}
          </p>
        </div>

        <div className="mb-16">
          <div className="bg-gradient-subtle rounded-2xl p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-4">{t("about.mission.title")}</h2>
                <p className="text-lg text-muted-foreground mb-6">{t("about.mission.description")}</p>
                <Button variant="hero" size="lg" asChild>
                  <Link to="/join">{t("about.mission.cta")}</Link>
                </Button>
              </div>
              <div className="bg-primary/10 rounded-xl p-6 text-center">
                <h3 className="text-2xl font-bold text-primary mb-2">{t("about.mission.stat")}</h3>
                <p className="text-muted-foreground">{t("about.mission.statLabel")}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">{t("about.values.title")}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <Card key={index} className="text-center hover:shadow-elegant transition-all duration-300">
                  <CardHeader>
                    <div className="flex justify-center mb-4">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <Icon className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                    <CardTitle className="text-xl">{value.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">
                      {value.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="mb-16">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6">{t("about.story.title")}</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>{t("about.story.p1")}</p>
                <p>{t("about.story.p2")}</p>
                <p>{t("about.story.p3")}</p>
              </div>
            </div>
            <div className="bg-gradient-accent rounded-2xl p-8 text-center text-white">
              <h3 className="text-2xl font-bold mb-4">{t("about.story.ctaTitle")}</h3>
              <p className="mb-6 opacity-90">{t("about.story.ctaDescription")}</p>
              <Button variant="secondary" size="lg" asChild>
                <Link to="/join">{t("about.story.ctaButton")}</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">{t("about.partners.title")}</h2>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-12">
            {t("about.partners.subtitle")}
          </p>
          {isLoadingPartners ? (
            <div className="flex gap-4 overflow-hidden px-8">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-56 min-w-[85%] sm:min-w-[48%] lg:min-w-[32%] shrink-0 rounded-lg" />
              ))}
            </div>
          ) : partners.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t("about.partners.empty")}</p>
            </div>
          ) : (
            <PartnersCarousel variant="card" partners={partners} className="px-8 md:px-14" />
          )}
        </div>

        <div className="text-center bg-gradient-primary rounded-2xl p-6 sm:p-8 md:p-12 text-white">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">{t("about.cta.title")}</h2>
          <p className="text-lg sm:text-xl mb-6 sm:mb-8 opacity-90">{t("about.cta.subtitle")}</p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Button variant="secondary" size="lg" className="min-h-[48px]" asChild>
              <Link to="/opportunities">{t("about.cta.browse")}</Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 min-h-[48px]"
              asChild
            >
              <Link to="/partners">{t("about.cta.partner")}</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;
