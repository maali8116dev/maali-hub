import { Shield, Lock, Award, Globe } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { useTranslation } from "react-i18next";

const TrustIndicators = () => {
  const { t } = useTranslation('landing');
  

  const partners = [
    "TechNuru",
    "GAT",
    "African Ventures", "TechNuru",
    "GAT",
    "African Ventures",
    "African Ventures",
    "Innovation Hub"
  ];
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) {
      return;
    }

    setTimeout(() => {
      if (api.selectedScrollSnap() + 1 === api.scrollSnapList().length) {
        setCurrent(0);
        api.scrollTo(0);
      } else {
        api.scrollNext();
        setCurrent(current + 1);
      }
    }, 1000);
  }, [api, current]);

  return (<>
<section className="py-20 md:py-24 bg-background">
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
          {t('trustIndicators.title')} <span className="bg-gradient-primary bg-clip-text text-transparent">{t('trustIndicators.titleHighlight')}</span> Worldwide
        </h2>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
         {t('trustIndicators.subtitle')}
          </p>
          </div>
        <Carousel setApi={setApi} className="w-full">
          <CarouselContent>
            {partners.map((partner, index) => (
              <CarouselItem className="basis-1/4 lg:basis-1/6" key={index}>
                <div className="flex rounded-md aspect-square bg-muted items-center justify-center p-6">
                  <span className="text-sm">Logo {index + 1}</span>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    
    </section>
    </>
 


  );
};

export default TrustIndicators;

