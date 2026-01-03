import { Card, CardContent } from "@/components/ui/card";
import { Quote } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Testimonials = () => {
  const testimonials = [
    {
      name: "Ahmed Hassan",
      company: "FinTech Solutions",
      location: "Kenya",
      image: "AH",
      quote: "Maali made it so easy to find and apply for funding. Within 3 months, I secured $75K for my fintech startup. The platform is intuitive and the support team is amazing.",
      result: "$75K Funded",
      sector: "Fintech"
    },
    {
      name: "Kofi Mensah",
      company: "EdTech Platform",
      location: "Ghana",
      image: "KM",
      quote: "As a first-time entrepreneur, I was overwhelmed by the funding process. Maali guided me through every step and connected me with the right opportunities. Highly recommended!",
      result: "$120K Investment",
      sector: "Education"
    },
    {
      name: "Amina Okafor",
      company: "AgriTech Innovations",
      location: "Nigeria",
      image: "AO",
      quote: "The multilingual support and mobile-first design made it perfect for me. I could work on my application even with limited internet. This platform truly understands African entrepreneurs.",
      result: "$50K Funded",
      sector: "Agriculture"
    }
  ];

  return (
    <section className="py-20 md:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Success <span className="bg-gradient-primary bg-clip-text text-transparent">Stories</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Hear from entrepreneurs who've successfully secured funding through Maali
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="group hover:shadow-elegant transition-all duration-300 hover:-translate-y-2 border-border">
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                      {testimonial.image}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.company}</div>
                    <div className="text-xs text-muted-foreground">{testimonial.location}</div>
                  </div>
                  <Quote className="h-6 w-6 text-primary/30 flex-shrink-0" />
                </div>
                
                <p className="text-muted-foreground leading-relaxed mb-4 italic">
                  "{testimonial.quote}"
                </p>
                
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="text-sm">
                    <div className="font-semibold text-success">{testimonial.result}</div>
                    <div className="text-xs text-muted-foreground">{testimonial.sector}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;

