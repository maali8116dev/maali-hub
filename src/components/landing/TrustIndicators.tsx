import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { useTranslation } from "react-i18next";
import { useFeaturedPartners } from "@/hooks/usePartners";
import { Skeleton } from "@/components/ui/skeleton";

const TrustIndicators = () => {
  const { t } = useTranslation('landing');
  const { data: partners = [], isLoading } = useFeaturedPartners();
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api || partners.length === 0) {
      return;
    }

    const interval = setInterval(() => {
      const currentIndex = api.selectedScrollSnap();
      const totalSlides = api.scrollSnapList().length;
      
      if (currentIndex + 1 >= totalSlides) {
        setCurrent(0);
        api.scrollTo(0);
      } else {
        api.scrollNext();
        setCurrent((prev) => prev + 1);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [api, partners.length]);

  return (<>
<section className="py-20 md:py-24 bg-background">
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
          {t('trustIndicators.title')} <span className="bg-gradient-primary bg-clip-text text-transparent">{t('trustIndicators.titleHighlight')}</span> {t('trustIndicators.worldwide')}
        </h2>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
         {t('trustIndicators.subtitle')}
          </p>
          </div>
        {isLoading ? (
          <div className="flex gap-4 justify-center">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="w-32 h-32 rounded-full" />
            ))}
          </div>
        ) : partners.length > 0 ? (
          <Carousel setApi={setApi} className="w-full">
            <CarouselContent>
              {partners.map((partner) => (
                <CarouselItem className="basis-1/4 lg:basis-1/6" key={partner.id}>
                  <a
                    href={partner.website_url || "#"}
                    target={partner.website_url ? "_blank" : undefined}
                    rel={partner.website_url ? "noopener noreferrer" : undefined}
                    className="flex rounded-full aspect-square bg-muted items-center justify-center p-2 hover:bg-muted/80 transition-colors group overflow-hidden"
                  >
                    {partner.logo_url ? (
                      <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
                        <img
                          src={partner.logo_url}
                          alt={partner.name}
                          className="w-full h-full object-contain  opacity-70 group-hover:opacity-100 transition-opacity"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                            const fallback = (e.target as HTMLImageElement).parentElement?.parentElement;
                            if (fallback) {
                              fallback.innerHTML = `<span class="text-sm text-muted-foreground text-center">${partner.name}</span>`;
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground text-center">{partner.name}</span>
                    )}
                  </a>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        ) : null}
      </div>
    
    </section>
    </>
 


  );
};

export default TrustIndicators;

