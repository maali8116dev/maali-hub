import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

const ProgressionSection = () => {
  const { t } = useTranslation("landing");

  const buildItems = [
    t("progression.build1"),
    t("progression.build2"),
    t("progression.build3"),
    t("progression.build4"),
  ];

  const qualifyItems = [
    t("progression.qualify1"),
    t("progression.qualify2"),
    t("progression.qualify3"),
    t("progression.qualify4"),
  ];

  return (
    <section className="py-20 md:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            {t("progression.title")}{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              {t("progression.titleHighlight")}
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            {t("progression.body")}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="rounded-xl border border-border bg-card p-8">
            <h3 className="text-xl font-semibold text-foreground mb-4">
              {t("progression.buildTitle")}
            </h3>
            <ul className="space-y-3">
              {buildItems.map((item) => (
                <li key={item} className="flex items-start gap-2 text-muted-foreground">
                  <Check className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-8">
            <h3 className="text-xl font-semibold text-foreground mb-4">
              {t("progression.qualifyTitle")}
            </h3>
            <ul className="space-y-3">
              {qualifyItems.map((item) => (
                <li key={item} className="flex items-start gap-2 text-muted-foreground">
                  <Check className="h-5 w-5 text-success mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProgressionSection;
