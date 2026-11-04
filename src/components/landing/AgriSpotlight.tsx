import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sprout } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const AgriSpotlight = () => {
  const navigate = useNavigate();
  const { t } = useTranslation("landing");

  return (
    <section className="py-20 md:py-24 bg-muted/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30 bg-primary/5">
            <Sprout className="h-3.5 w-3.5 mr-1.5" />
            {t("spotlight.badge")}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t("spotlight.title")}
          </h2>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            {t("spotlight.body")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              variant="hero"
              size="lg"
              className="group"
              onClick={() => navigate("/opportunities")}
            >
              {t("spotlight.ctaPrimary")}
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate("/contact")}>
              {t("spotlight.ctaSecondary")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AgriSpotlight;
