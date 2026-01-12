import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Handshake, Heart, Globe } from "lucide-react";

const Partners = () => {
  const partnerCategories = [
    {
      title: "Funding Partners",
      icon: Building2,
      description: "Organizations providing financial support to entrepreneurs",
      partners: [
        { name: "African Development Bank", logo: "🏦", description: "Leading development finance institution" },
        { name: "Mastercard Foundation", logo: "💳", description: "Advancing financial inclusion across Africa" },
        { name: "Tony Elumelu Foundation", logo: "🌟", description: "Empowering African entrepreneurs" },
        { name: "African Business Angels Network", logo: "👔", description: "Connecting startups with angel investors" }
      ]
    },
    {
      title: "Support Partners",
      icon: Handshake,
      description: "Organizations offering mentorship and business support",
      partners: [
        { name: "Techstars", logo: "🚀", description: "Global startup accelerator network" },
        { name: "Y Combinator", logo: "💡", description: "Premier startup accelerator" },
        { name: "Andela", logo: "💻", description: "Building remote engineering teams" },
        { name: "MEST Africa", logo: "🎓", description: "Training the next generation of tech entrepreneurs" }
      ]
    },
    {
      title: "Impact Partners",
      icon: Heart,
      description: "Organizations focused on social impact and community development",
      partners: [
        { name: "Acumen", logo: "❤️", description: "Patient capital for social enterprises" },
        { name: "Village Capital", logo: "🌍", description: "Supporting impact-driven startups" },
        { name: "Unreasonable Group", logo: "⚡", description: "Accelerating ventures solving global challenges" }
      ]
    },
    {
      title: "Regional Partners",
      icon: Globe,
      description: "Organizations with strong regional presence",
      partners: [
        { name: "East Africa Ventures", logo: "🌐", description: "Supporting East African startups" },
        { name: "West Africa Innovation Network", logo: "🔗", description: "Connecting West African innovators" },
        { name: "Southern Africa Tech Hub", logo: "💼", description: "Fostering tech innovation in Southern Africa" }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Our Partners</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            We work with leading organizations across Africa and beyond to provide comprehensive support
            to entrepreneurs. Together, we're building a stronger ecosystem for African innovation.
          </p>
        </div>

        {partnerCategories.map((category, categoryIndex) => {
          const Icon = category.icon;
          return (
            <div key={categoryIndex} className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <Icon className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-bold">{category.title}</h2>
              </div>
              <p className="text-muted-foreground mb-6">{category.description}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {category.partners.map((partner, partnerIndex) => (
                  <Card key={partnerIndex} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="text-4xl mb-2">{partner.logo}</div>
                        <Badge variant="outline">Partner</Badge>
                      </div>
                      <CardTitle className="text-lg">{partner.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{partner.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}

        {/* Become a Partner Section */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>Interested in Partnering with Us?</CardTitle>
            <CardDescription>
              Join our network of partners and help empower African entrepreneurs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              We're always looking for organizations that share our mission of supporting African entrepreneurs.
              Whether you're a funder, accelerator, or support organization, we'd love to explore partnership opportunities.
            </p>
            <a href="/contact">
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                Contact Us
              </button>
            </a>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Partners;

