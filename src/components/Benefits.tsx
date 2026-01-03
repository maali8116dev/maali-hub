import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Target, Users, Award } from "lucide-react";

const Benefits = () => {
  const benefits = [
    {
      icon: Zap,
      title: "Fast & Simple",
      description: "Complete applications in minutes, not hours. Our streamlined process saves you time.",
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      icon: Target,
      title: "Focused Opportunities",
      description: "Find funding specifically designed for African entrepreneurs and businesses.",
      color: "text-accent",
      bgColor: "bg-accent/10"
    },
    {
      icon: Users,
      title: "Expert Support",
      description: "Get guidance from experienced mentors and reviewers throughout your journey.",
      color: "text-success",
      bgColor: "bg-success/10"
    },
    {
      icon: Award,
      title: "Proven Results",
      description: "Join hundreds of successful entrepreneurs who've secured funding through our platform.",
      color: "text-warning",
      bgColor: "bg-warning/10"
    }
  ];

  return (
    <section className="py-20 md:py-24 bg-gradient-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Why Choose <span className="bg-gradient-accent bg-clip-text text-transparent">Maali</span>?
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            We've built a platform specifically for African entrepreneurs, addressing your unique needs and challenges.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {benefits.map((benefit, index) => {
            const IconComponent = benefit.icon;
            return (
              <Card key={index} className="group hover:shadow-elegant transition-all duration-300 hover:-translate-y-1 border-border">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-lg ${benefit.bgColor} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                      <IconComponent className={`h-7 w-7 ${benefit.color}`} />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-2xl mb-2">{benefit.title}</CardTitle>
                      <p className="text-muted-foreground leading-relaxed">
                        {benefit.description}
                      </p>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Benefits;

