import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Target, Users, Globe } from "lucide-react";
import { usePublicPartners } from "@/hooks/usePartners";
import { PartnersCarousel } from "@/components/partners/PartnersCarousel";
import { Skeleton } from "@/components/ui/skeleton";

const About = () => {
  const { data: partners = [], isLoading: isLoadingPartners } = usePublicPartners();
  const values = [
    {
      icon: Heart,
      title: "Empowerment",
      description: "We believe in empowering African entrepreneurs to drive positive change in their communities."
    },
    {
      icon: Target,
      title: "Innovation",
      description: "Supporting innovative solutions that address real challenges across the continent."
    },
    {
      icon: Users,
      title: "Collaboration",
      description: "Building strong partnerships between entrepreneurs, funders, and support organizations."
    },
    {
      icon: Globe,
      title: "Impact",
      description: "Creating sustainable impact that benefits communities and drives economic growth."
    }
  ];

  const team = [
    {
      name: "TechNuru",
      role: "Technology Partner",
      description: "Leading technology solutions and digital transformation across Africa."
    },
    {
      name: "GAT (Global Action Trust)",
      role: "Strategic Partner",
      description: "Driving global initiatives for sustainable development and social impact."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Hero Section */}
        <div className="text-center mb-12 sm:mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-hero bg-clip-text text-transparent mb-4 sm:mb-6">
            About Maali
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed px-4">
            Maali is more than a platform -it's a movement to unlock the potential of African entrepreneurs 
            through accessible funding, mentorship, and community support.
          </p>
        </div>

        {/* Mission Section */}
        <div className="mb-16">
          <div className="bg-gradient-subtle rounded-2xl p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-4">Our Mission</h2>
                <p className="text-lg text-muted-foreground mb-6">
                  To democratize access to funding and opportunities for African entrepreneurs, 
                  fostering innovation and sustainable economic growth across the continent.
                </p>
                <Button variant="hero" size="lg">
                  Join Our Mission
                </Button>
              </div>
              <div className="bg-primary/10 rounded-xl p-6 text-center">
                <h3 className="text-2xl font-bold text-primary mb-2">1000+</h3>
                <p className="text-muted-foreground">Entrepreneurs Supported</p>
              </div>
            </div>
          </div>
        </div>

        {/* Values Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">Our Values</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <Card key={index} className="text-center hover:shadow-elegant transition-all duration-300">
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <value.icon className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <CardTitle className="text-xl">{value.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {value.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Story Section */}
        <div className="mb-16">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6">Our Story</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Maali was born from a simple observation: Africa is home to some of the world's most 
                  innovative entrepreneurs, yet many struggle to access the funding and support they need 
                  to scale their impact.
                </p>
                <p>
                  Our name "Maali" means "wealth" in several African languages, reflecting our commitment 
                  to creating pathways to prosperity for entrepreneurs across the continent.
                </p>
                <p>
                  Through technology and community, we're breaking down barriers and creating new 
                  opportunities for African innovation to thrive on the global stage.
                </p>
              </div>
            </div>
            <div className="bg-gradient-accent rounded-2xl p-8 text-center text-white">
              <h3 className="text-2xl font-bold mb-4">Join the Movement</h3>
              <p className="mb-6 opacity-90">
                Be part of the ecosystem that's transforming African entrepreneurship
              </p>
              <Button variant="secondary" size="lg">
                Get Started Today
              </Button>
            </div>
          </div>
        </div>

        {/* Partners Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">Our Partners</h2>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-12">
            Organizations powering opportunities across Africa
          </p>
          {isLoadingPartners ? (
            <div className="flex gap-4 overflow-hidden px-8">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-56 min-w-[85%] sm:min-w-[48%] lg:min-w-[32%] shrink-0 rounded-lg" />
              ))}
            </div>
          ) : partners.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No partners available at this time.</p>
            </div>
          ) : (
            <PartnersCarousel variant="card" partners={partners} className="px-8 md:px-14" />
          )}
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-primary rounded-2xl p-6 sm:p-8 md:p-12 text-white">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">Ready to Transform Your Business?</h2>
          <p className="text-lg sm:text-xl mb-6 sm:mb-8 opacity-90">
            Join thousands of African entrepreneurs who are building the future with Maali
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Button variant="secondary" size="lg" className="min-h-[48px]">
              Apply for Opportunities
            </Button>
            <Button variant="outline" size="lg" className="bg-white/10 border-white/20 text-white hover:bg-white/20 min-h-[48px]">
              Become a Partner
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;







