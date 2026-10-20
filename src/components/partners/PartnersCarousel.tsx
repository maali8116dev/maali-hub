import { useState } from "react";
import { Building2, ExternalLink } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCarouselAutoplay } from "@/hooks/useCarouselAutoplay";

export type CarouselPartner = {
  id: number;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  website_url?: string | null;
  sector?: string;
  featured?: boolean;
};

type PartnersCarouselProps = {
  partners: CarouselPartner[];
  variant: "logo" | "card";
  autoplayMs?: number;
  className?: string;
};

export function PartnersCarousel({
  partners,
  variant,
  autoplayMs = 2000,
  className,
}: PartnersCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  useCarouselAutoplay(api, partners.length, autoplayMs);

  if (partners.length === 0) return null;

  const itemBasis =
    variant === "logo"
      ? "basis-1/4 lg:basis-1/6"
      : "basis-[85%] sm:basis-1/2 lg:basis-1/3";

  return (
    <Carousel setApi={setApi} className={className ?? "w-full"} opts={{ align: "start", loop: true }}>
      <CarouselContent className="-ml-2 md:-ml-4">
        {partners.map((partner) => (
          <CarouselItem key={partner.id} className={`pl-2 md:pl-4 ${itemBasis}`}>
            {variant === "logo" ? (
              <PartnerLogoSlide partner={partner} />
            ) : (
              <PartnerCardSlide partner={partner} />
            )}
          </CarouselItem>
        ))}
      </CarouselContent>
      {partners.length > 1 && (
        <>
          <CarouselPrevious
            className={variant === "card" ? "left-0" : "left-0 md:-left-12"}
          />
          <CarouselNext
            className={variant === "card" ? "right-0" : "right-0 md:-right-12"}
          />
        </>
      )}
    </Carousel>
  );
}

function PartnerLogoSlide({ partner }: { partner: CarouselPartner }) {
  return (
    <a
      href={partner.website_url || "#"}
      target={partner.website_url ? "_blank" : undefined}
      rel={partner.website_url ? "noopener noreferrer" : undefined}
      className="flex rounded-full aspect-square bg-muted items-center justify-center p-2 hover:bg-muted/80 transition-colors group overflow-hidden"
      onClick={(e) => {
        if (!partner.website_url) e.preventDefault();
      }}
    >
      {partner.logo_url ? (
        <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
          <img
            src={partner.logo_url}
            alt={partner.name}
            className="w-full h-full object-contain opacity-70 group-hover:opacity-100 transition-opacity"
          />
        </div>
      ) : (
        <span className="text-sm text-muted-foreground text-center px-2">{partner.name}</span>
      )}
    </a>
  );
}

function PartnerCardSlide({ partner }: { partner: CarouselPartner }) {
  return (
    <Card className="h-full hover:shadow-elegant transition-all duration-300">
      <CardHeader>
        <div className="flex items-start justify-between mb-2 gap-2">
          {partner.logo_url ? (
            <div className="w-16 h-16 shrink-0 rounded-full overflow-hidden bg-muted flex items-center justify-center">
              <img
                src={partner.logo_url}
                alt={partner.name}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-16 h-16 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Building2 className="h-8 w-8" aria-hidden />
            </div>
          )}
          {partner.featured && <Badge className="ml-auto shrink-0">Featured</Badge>}
        </div>
        <CardTitle className="text-xl">{partner.name}</CardTitle>
        {partner.sector && (
          <CardDescription className="text-primary font-medium">{partner.sector}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {partner.description && (
          <p className="text-muted-foreground mb-3 line-clamp-3">{partner.description}</p>
        )}
        {partner.website_url && (
          <a
            href={partner.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Visit Website
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}
