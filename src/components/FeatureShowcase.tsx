import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { 
  FileText, 
  Shield, 
  Smartphone, 
  Users, 
  Globe, 
  TrendingUp,
  Clock,
  MessageSquare,
  CreditCard
} from "lucide-react";

const FeatureShowcase = () => {
  const features = [
    {
      icon: FileText,
      title: "Smart Application System",
      description: "AI-guided application process with document templates and real-time validation to ensure your submission is complete and compelling.",
      color: "text-primary"
    },
    {
      icon: Shield,
      title: "Secure Document Storage",
      description: "Bank-level security for your sensitive documents with encrypted storage and controlled access to protect your intellectual property.",
      color: "text-accent"
    },
    {
      icon: Smartphone,
      title: "Mobile-First Experience",
      description: "Optimized for mobile devices with offline capabilities, ensuring you can work on applications even with limited connectivity.",
      color: "text-success"
    },
    {
      icon: Users,
      title: "Collaborative Review",
      description: "Transparent review process with multiple stakeholders, detailed feedback, and clear communication throughout the evaluation.",
      color: "text-warning"
    },
    {
      icon: Globe,
      title: "Multilingual Support",
      description: "Available in English, French, and Portuguese to serve entrepreneurs across all regions of Africa seamlessly.",
      color: "text-primary"
    },
    {
      icon: TrendingUp,
      title: "Progress Tracking",
      description: "Real-time updates on your application status with detailed analytics and insights to improve future submissions.",
      color: "text-accent"
    },
    {
      icon: Clock,
      title: "Deadline Management",
      description: "Smart notifications and reminders to keep you on track with application deadlines and required documentation.",
      color: "text-success"
    },
    {
      icon: MessageSquare,
      title: "Direct Communication",
      description: "Built-in messaging system for direct communication with reviewers, mentors, and other entrepreneurs in the ecosystem.",
      color: "text-warning"
    },
    {
      icon: CreditCard,
      title: "Flexible Payments",
      description: "Multiple payment options including Mobile Money, Paystack, and Stripe to accommodate different preferences and regions.",
      color: "text-primary"
    }
  ];

  return (
    <section className="py-20 md:py-24 bg-gradient-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Built for <span className="bg-gradient-accent bg-clip-text text-transparent">African</span> Entrepreneurs
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Every feature is designed with the unique challenges and opportunities of the African entrepreneurship ecosystem in mind.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <Card key={index} className="group hover:shadow-elegant transition-all duration-300 hover:-translate-y-1 border-border">
                <CardHeader className="pb-4">
                  <div className={`w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <IconComponent className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeatureShowcase;