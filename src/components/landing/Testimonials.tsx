import { Card, CardContent } from "@/components/ui/card";
import { Quote } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTranslation } from "react-i18next";

const Testimonials = () => {
  const { t } = useTranslation('landing');
  const testimonials = [
    {
      name: t('testimonials.testimonial1.name'),
      company: t('testimonials.testimonial1.company'),
      location: t('testimonials.testimonial1.location'),
      image: "AH",
      quote: t('testimonials.testimonial1.quote'),
      result: t('testimonials.testimonial1.result'),
      sector: t('testimonials.testimonial1.sector')
    },
    {
      name: t('testimonials.testimonial2.name'),
      company: t('testimonials.testimonial2.company'),
      location: t('testimonials.testimonial2.location'),
      image: "KM",
      quote: t('testimonials.testimonial2.quote'),
      result: t('testimonials.testimonial2.result'),
      sector: t('testimonials.testimonial2.sector')
    },
    {
      name: t('testimonials.testimonial3.name'),
      company: t('testimonials.testimonial3.company'),
      location: t('testimonials.testimonial3.location'),
      image: "AO",
      quote: t('testimonials.testimonial3.quote'),
      result: t('testimonials.testimonial3.result'),
      sector: t('testimonials.testimonial3.sector')
    }
  ];

  return (
    <section className="py-20 md:py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            {t('testimonials.title')} <span className="bg-gradient-primary bg-clip-text text-transparent">{t('testimonials.titleHighlight')}</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            {t('testimonials.subtitle')}
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

