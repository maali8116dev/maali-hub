import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, MapPin, Calendar, TrendingUp, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeaturedSuccessStories } from "@/hooks/useSuccessStories";

const SuccessStoriesSection = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('landing');
  const { data: stories = [], isLoading } = useFeaturedSuccessStories();

  return (
    <section className="py-16 sm:py-20 md:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4">
            {t('successStories.title', 'Success')} <span className="bg-gradient-primary bg-clip-text text-transparent">{t('successStories.titleHighlight', 'Stories')}</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto px-4">
            {t('successStories.subtitle', 'Discover how African entrepreneurs are transforming their communities and building successful businesses with funding from our platform.')}
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
        ) : stories.length === 0 ? (
          <Card className="mb-12">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No success stories available at this time.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-12">
            {stories.map((story) => (
              <Card key={story.id} className="group hover:shadow-elegant transition-all duration-300 hover:-translate-y-2 border-border">
                <CardHeader>
                  <div className="mb-4">
                    {story.image_url ? (
                      <div className="w-full h-32 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                        <img
                          src={story.image_url}
                          alt={story.company}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                            (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="text-4xl">🌟</div>';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-32 rounded-lg bg-muted flex items-center justify-center text-4xl">
                        🌟
                      </div>
                    )}
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
                  <Badge variant="outline" className="mt-2 text-xs">{story.category}</Badge>
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

