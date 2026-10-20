import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, MapPin, Calendar, TrendingUp, ArrowRight, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeaturedSuccessStories } from "@/hooks/useSuccessStories";
import { useLocalizedSuccessStories } from "@/lib/localizedContent";

function StoryImage({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  const showPlaceholder = !src || failed;

  return (
    <div className="w-full h-32 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
      {showPlaceholder ? (
        <ImageIcon className="h-10 w-10 text-muted-foreground" aria-hidden />
      ) : (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

const SuccessStoriesSection = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('landing');
  const { data: stories = [], isLoading } = useFeaturedSuccessStories();
  const localizedStories = useLocalizedSuccessStories(stories);

  // Hide section when DB has no featured stories (no empty-state card).
  if (!isLoading && stories.length === 0) return null;

  return (
    <section className="py-16 sm:py-20 md:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4">
            {t('successStories.title', 'Success')} <span className="bg-gradient-primary bg-clip-text text-transparent">{t('successStories.titleHighlight', 'Stories')}</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto px-4">
            {t('successStories.subtitle')}
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-12">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-32 w-full mb-4" />
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-5/6" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-12">
            {localizedStories.map((story) => (
              <Card key={story.id} className="group hover:shadow-elegant transition-all duration-300 hover:-translate-y-2 border-border">
                <CardHeader>
                  <div className="mb-4">
                    <StoryImage src={story.image_url} alt={story.company} />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-lg sm:text-xl">{story.company}</CardTitle>
                    <div className="flex items-center gap-2">
                      {story.featured && <Badge variant="default" className="text-xs">Featured</Badge>}
                    </div>
                  </div>
                  <CardDescription className="text-sm sm:text-base font-medium">
                    {story.name}
                  </CardDescription>
                  <Badge variant="outline" className="mt-2 text-xs">{story.sector}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-3">{story.description}</p>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="font-semibold text-foreground">{story.funding_amount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">{story.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">Funded: {new Date(story.funding_date).getFullYear()}</span>
                    </div>
                  </div>

                  {story.impact_metrics && (
                    <div className="pt-3 border-t border-border">
                      <div className="flex items-center gap-2 text-sm">
                        <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="font-medium text-primary">{story.impact_metrics}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="text-center">
          <Button 
            variant="outline" 
            size="lg" 
            className="group"
            onClick={() => navigate("/success-stories")}
          >
            {t('successStories.viewAll', 'View All Success Stories')}
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default SuccessStoriesSection;









