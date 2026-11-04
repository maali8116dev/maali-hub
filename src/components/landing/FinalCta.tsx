import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const FinalCta = () => {
  const navigate = useNavigate();
  const { t } = useTranslation("landing");

  return (
    <section className="py-20 md:py-24 bg-gradient-subtle">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
          {t("finalCta.title")}
        </h2>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          {t("finalCta.body")}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            variant="hero"
            size="lg"
            className="group"
            onClick={() => navigate("/auth")}
          >
            {t("finalCta.ctaPrimary")}
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate("/opportunities")}>
            {t("finalCta.ctaSecondary")}
          </Button>
          <Button variant="ghost" size="lg" onClick={() => navigate("/partners")}>
            {t("finalCta.ctaPartners")}
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FinalCta;
