import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { CheckCircle, FileText, Upload, Eye, ArrowRight, Lightbulb, AlertCircle } from "lucide-react";
import { QuickLinks } from "@/components/resources/QuickLinks";

type GuideStep = { title: string; description: string; tips: string[]; action: string };
type BestPractice = { title: string; description: string };

const STEP_ICONS = [CheckCircle, FileText, Eye, Upload, CheckCircle, Eye] as const;
const STEP_LINKS = ["/auth", "/dashboard/profile", "/opportunities", "/opportunities", "/apply", "/dashboard"] as const;
const PRACTICE_ICONS = [Lightbulb, FileText, CheckCircle, AlertCircle] as const;

const Guide = () => {
  const { t } = useTranslation("landing");

  const steps = useMemo(
    () => t("guidePage.steps", { returnObjects: true }) as GuideStep[],
    [t],
  );
  const bestPractices = useMemo(
    () => t("guidePage.bestPractices", { returnObjects: true }) as BestPractice[],
    [t],
  );
  const mistakes = useMemo(
    () => t("guidePage.mistakes", { returnObjects: true }) as string[],
    [t],
  );

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t("guidePage.title")}</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">{t("guidePage.subtitle")}</p>
        </div>

        <Card className="mb-12">
          <CardHeader>
            <CardTitle>{t("guidePage.introTitle")}</CardTitle>
            <CardDescription>{t("guidePage.introDesc")}</CardDescription>
          </CardHeader>
        </Card>

        <div className="space-y-8 mb-12">
          {steps.map((step, index) => {
            const Icon = STEP_ICONS[index] ?? CheckCircle;
            return (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xl font-bold text-primary">{index + 1}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-2xl">{step.title}</CardTitle>
                      </div>
                      <CardDescription className="text-base">{step.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="ml-16 space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">{t("guidePage.tipsLabel")}</h4>
                      <ul className="space-y-1">
                        {step.tips.map((tip, tipIndex) => (
                          <li key={tipIndex} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <Link to={STEP_LINKS[index] ?? "/dashboard"}>
                        <Button variant="outline" size="sm">
                          {step.action}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6">{t("guidePage.bestPracticesTitle")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {bestPractices.map((practice, index) => {
              const Icon = PRACTICE_ICONS[index] ?? Lightbulb;
              return (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{practice.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{practice.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <Card className="mb-12 border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">{t("guidePage.mistakesTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {mistakes.map((mistake, index) => (
                <li key={index} className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <span>{mistake}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <QuickLinks className="mb-0 mt-0 pt-0 border-t-0" />
      </main>
      <Footer />
    </div>
  );
};

export default Guide;
