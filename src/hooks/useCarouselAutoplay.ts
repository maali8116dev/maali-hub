import { useEffect } from "react";
import type { CarouselApi } from "@/components/ui/carousel";

/** Auto-advance carousel; loops to start after last slide (matches landing TrustIndicators). */
export function useCarouselAutoplay(
  api: CarouselApi | undefined,
  itemCount: number,
  intervalMs = 2000,
) {
  useEffect(() => {
    if (!api || itemCount === 0) return;

    const interval = setInterval(() => {
      const currentIndex = api.selectedScrollSnap();
      const totalSlides = api.scrollSnapList().length;

      if (currentIndex + 1 >= totalSlides) {
        api.scrollTo(0);
      } else {
        api.scrollNext();
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [api, itemCount, intervalMs]);
}
