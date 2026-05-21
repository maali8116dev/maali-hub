import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Compass,
  UserPlus,
  ClipboardList,
  LineChart,
  Users,
  ClipboardCheck,
  Award,
  BookOpen,
  HelpCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const Apply = () => {
  const { t } = useTranslation("landing");

  const steps = [
    {
      icon: Compass,
      title: t("howItWorks.step1.title"),
      description: t("howItWorks.step1.description"),
    },
    {
      icon: UserPlus,
      title: t("howItWorks.step2.title"),
      description: t("howItWorks.step2.description"),
    },
    {
      icon: ClipboardList,
      title: t("howItWorks.step3.title"),
      description: t("howItWorks.step3.description"),
    },
    {
      icon: LineChart,
      title: t("howItWorks.step4.title"),
      description: t("howItWorks.step4.description"),
    },
  ];

  const stats = [
    { icon: Users, value: "500+", label: t("apply.stats.members") },
    { icon: ClipboardCheck, value: "2,000+", label: t("apply.stats.applications") },
    { icon: Award, value: "$50M+", label: t("apply.stats.support") },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t("apply.hero.title")}</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            {t("apply.hero.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/opportunities">
              <Button size="lg" variant="hero" className="w-full sm:w-auto group">
                {t("apply.hero.browseOpportunities")}
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link to="/guide">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                <BookOpen className="mr-2 h-5 w-5" />
                {t("apply.hero.viewGuide")}
              </Button>
            </Link>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-3xl font-bold text-center mb-8">{t("apply.howItWorksTitle")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card key={index} className="text-center">
                  <CardHeader>
                    <div className="flex justify-center mb-4">
                      <div className="p-3 rounded-full bg-primary/10">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <div className="flex justify-center mb-2">
                      <span className="text-2xl font-bold text-primary">{index + 1}</span>
                    </div>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card>
            <CardHeader>
              <CardTitle>{t("apply.ready.title")}</CardTitle>
              <CardDescription>{t("apply.ready.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/opportunities">
                <Button variant="hero" className="w-full group">
                  {t("apply.ready.cta")}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("apply.help.title")}</CardTitle>
              <CardDescription>{t("apply.help.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/guide">
                <Button variant="outline" className="w-full justify-start">
                  <BookOpen className="mr-2 h-4 w-4" />
                  {t("apply.help.guide")}
                </Button>
              </Link>
              <Link to="/faq">
                <Button variant="outline" className="w-full justify-start">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  {t("apply.help.faq")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="bg-muted/50 rounded-lg p-8 mb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {stats.map((stat) => {
              const StatIcon = stat.icon;
              return (
                <div key={stat.label}>
                  <div className="flex justify-center mb-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <StatIcon className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <div className="text-4xl font-bold text-primary mb-2">{stat.value}</div>
                  <p className="text-muted-foreground">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Apply;
