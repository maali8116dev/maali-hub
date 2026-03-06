import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Target, Users, Globe, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Partner = {
  id: number;
  name: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  category: string;
  featured: boolean;
};

const About = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoadingPartners, setIsLoadingPartners] = useState(true);

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    try {
      setIsLoadingPartners(true);
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .eq("status", "active")
        .order("display_order", { ascending: true })
        .order("featured", { ascending: false });

      if (error) throw error;
      setPartners(data || []);
    } catch (error) {
      console.error("Error fetching partners:", error);
    } finally {
      setIsLoadingPartners(false);
    }
  };

  // Group partners by category
  const partnersByCategory = partners.reduce((acc, partner) => {
    if (!acc[partner.category]) {
      acc[partner.category] = [];
    }
    acc[partner.category].push(partner);
    return acc;
  }, {} as Record<string, Partner[]>);

  const categoryIcons: Record<string, typeof Heart> = {
    Funding: Target,
    Support: Users,
    Impact: Heart,
    Regional: Globe,
    Technology: Globe,
    Strategic: Users,
  };
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
            Maali is more than a platform – it's a movement to unlock the potential of African entrepreneurs 
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
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">Our Partners</h2>
          {isLoadingPartners ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading partners...</p>
            </div>
          ) : partners.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No partners available at this time.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {Object.entries(partnersByCategory).map(([category, categoryPartners]) => {
                const Icon = categoryIcons[category] || Users;
                return (
                  <div key={category}>
                    <div className="flex items-center gap-3 mb-6">
                      <Icon className="h-6 w-6 text-primary" />
                      <h3 className="text-2xl font-bold">{category} Partners</h3>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {categoryPartners.map((partner) => (
                        <Card key={partner.id} className="hover:shadow-elegant transition-all duration-300">
                          <CardHeader>
                            <div className="flex items-start justify-between mb-2">
                              {partner.logo_url ? (
                                <div className="w-16 h-16 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                                  <img
                                    src={partner.logo_url}
                                    alt={partner.name}
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = "none";
                                      (e.target as HTMLImageElement).parentElement!.innerHTML = "🏢";
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                                  🏢
                                </div>
                              )}
                              {partner.featured && (
                                <Badge variant="default" className="ml-auto">Featured</Badge>
                              )}
                            </div>
                            <CardTitle className="text-xl">{partner.name}</CardTitle>
                            <CardDescription className="text-primary font-medium">
                              {partner.category}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            {partner.description && (
                              <p className="text-muted-foreground mb-3">{partner.description}</p>
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
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
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
              Apply for Funding
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