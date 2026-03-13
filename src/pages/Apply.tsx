import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, FileText, Search, CheckCircle, Clock, Users } from "lucide-react";

const Apply = () => {
  const steps = [
    {
      icon: Search,
      title: "Browse Opportunities",
      description: "Explore available funding opportunities that match your business needs and goals."
    },
    {
      icon: FileText,
      title: "Complete Application",
      description: "Fill out the application form with your business details and required documents."
    },
    {
      icon: Clock,
      title: "Review Process",
      description: "Our team reviews your application and may request additional information."
    },
    {
      icon: CheckCircle,
      title: "Get Funded",
      description: "Receive funding and start growing your business with our support."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Start Your Application Journey
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Join thousands of African entrepreneurs who have successfully secured funding through our platform.
            Take the first step towards growing your business today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/opportunities">
              <Button size="lg" variant="hero" className="w-full sm:w-auto">
                Browse Opportunities
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/guide">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                View Application Guide
              </Button>
            </Link>
          </div>
        </div>

        {/* Application Process */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card key={index} className="text-center">
                  <CardHeader>
                    <div className="flex justify-center mb-4">
                      <div className="p-3 rounded-full bg-primary/10">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <div className="flex justify-center mb-2">
                      <span className="text-2xl font-bold text-primary">{index + 1}</span>
                    </div>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card>
            <CardHeader>
              <CardTitle>Ready to Apply?</CardTitle>
              <CardDescription>
                Browse our current funding opportunities and find the perfect match for your business.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/opportunities">
                <Button variant="hero" className="w-full">
                  View All Projects
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
              <CardDescription>
                Learn more about the application process and get answers to common questions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/guide">
                <Button variant="outline" className="w-full justify-start">
                  Application Guide
                </Button>
              </Link>
              <Link to="/faq">
                <Button variant="outline" className="w-full justify-start">
                  Frequently Asked Questions
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <div className="bg-muted/50 rounded-lg p-8 mb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">500+</div>
              <p className="text-muted-foreground">Active Opportunities</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">2,000+</div>
              <p className="text-muted-foreground">Successful Applications</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">$50M+</div>
              <p className="text-muted-foreground">Total Funding Disbursed</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Apply;









