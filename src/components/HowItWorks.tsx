import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, UserPlus, FileText, TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const HowItWorks = () => {
  const navigate = useNavigate();

  const steps = [
    {
      number: 1,
      icon: Search,
      title: "Browse Opportunities",
      description: "Explore funding opportunities across various sectors. Filter by location, funding amount, and sector to find the perfect match.",
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      number: 2,
      icon: UserPlus,
      title: "Create Your Profile",
      description: "Sign up in minutes and create your entrepreneur profile. Showcase your business, experience, and vision.",
      color: "text-accent",
      bgColor: "bg-accent/10"
    },
    {
      number: 3,
      icon: FileText,
      title: "Submit Application",
      description: "Complete your application with our guided process. Upload documents, provide details, and submit with confidence.",
      color: "text-success",
      bgColor: "bg-success/10"
    },
    {
      number: 4,
      icon: TrendingUp,
      title: "Get Funded",
      description: "Track your application status in real-time. Receive feedback and get funded to grow your business.",
      color: "text-warning",
      bgColor: "bg-warning/10"
    }
  ];

  return (
    <section className="py-20 md:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            How It <span className="bg-gradient-primary bg-clip-text text-transparent">Works</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Get started in four simple steps. From discovery to funding, we've streamlined the entire process.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {steps.map((step, index) => {
            const IconComponent = step.icon;
            return (
              <div key={step.number} className="relative">
                <Card className="h-full hover:shadow-elegant transition-all duration-300 hover:-translate-y-2 border-border">
                  <CardHeader className="text-center">
                    <div className={`w-16 h-16 mx-auto rounded-full ${step.bgColor} flex items-center justify-center mb-4`}>
                      <IconComponent className={`h-8 w-8 ${step.color}`} />
                    </div>
                    <div className="absolute -top-3 -right-3 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm">
                      {step.number}
                    </div>
                    <CardTitle className="text-xl mb-2">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-center leading-relaxed">
                      {step.description}
                    </p>
                  </CardContent>
                </Card>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 right-[-25px] transform -translate-y-1/2 z-10">
                    <ArrowRight className="h-6 w-6 text-muted-foreground " />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <Button 
            size="lg" 
            variant="hero" 
            className="group"
            onClick={() => navigate("/auth")}
          >
            Get Started Today
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

