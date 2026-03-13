import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, MapPin, Calendar, TrendingUp } from "lucide-react";
import { useSuccessStories } from "@/hooks/useSuccessStories";

const SuccessStories = () => {
  const { data: stories = [], isLoading } = useSuccessStories();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Success Stories</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Discover how African entrepreneurs are transforming their communities and building successful businesses
            with funding from our platform.
          </p>
        </div>

        {/* Stories Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading success stories...</p>
          </div>
        ) : stories.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No success stories available at this time.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {stories.map((story) => (
              <Card key={story.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="text-6xl mb-4 text-center">
                    {story.image_url ? (
                      <div className="w-full h-32 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                        <img
                          src={story.image_url}
                          alt={story.company}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                            (e.target as HTMLImageElement).parentElement!.innerHTML = "ðŸŒŸ";
                          }}
                        />
                      </div>
                    ) : (
                      "ðŸŒŸ"
                    )}
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-xl">{story.company}</CardTitle>
                    <div className="flex items-center gap-2">
                      {story.featured && <Badge variant="default">Featured</Badge>}
                      <Badge variant="outline">{story.sector}</Badge>
                    </div>
                  </div>
                  <CardDescription className="text-base font-medium">
                    {story.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{story.description}</p>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">Funding: {story.funding_amount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{story.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Funded: {new Date(story.funding_date).getFullYear()}</span>
                    </div>
                  </div>

                  {story.impact_metrics && (
                    <div className="pt-3 border-t">
                      <div className="flex items-center gap-2 text-sm">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <span className="font-medium text-primary">{story.impact_metrics}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* CTA Section */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>Ready to Write Your Success Story?</CardTitle>
            <CardDescription>
              Join these successful entrepreneurs and start your funding journey today.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/apply">
              <Button variant="hero">Start Your Application</Button>
            </a>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default SuccessStories;









