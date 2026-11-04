import { useTranslation } from "react-i18next";
import { useFeaturedPartners } from "@/hooks/usePartners";
import { Skeleton } from "@/components/ui/skeleton";
import { PartnersCarousel } from "@/components/partners/PartnersCarousel";

const TrustIndicators = () => {
  const { t } = useTranslation("landing");
  const { data: partners = [], isLoading } = useFeaturedPartners();

  return (
    <section className="py-20 md:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            {t("trustIndicators.title")}{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              {t("trustIndicators.titleHighlight")}
            </span>{" "}
            {t("trustIndicators.worldwide")}
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            {t("trustIndicators.subtitle")}
          </p>
        </div>
        {isLoading ? (
          <div className="flex gap-4 justify-center">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="w-32 h-32 rounded-full" />
            ))}
          </div>
        ) : (
          <PartnersCarousel variant="logo" partners={partners} />
        )}
      </div>
    </section>
  );
};

export default TrustIndicators;
