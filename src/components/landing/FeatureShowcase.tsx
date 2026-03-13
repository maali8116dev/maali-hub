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
import { useTranslation } from "react-i18next";

const FeatureShowcase = () => {
  const { t } = useTranslation('landing');
  const features = [
    {
      icon: FileText,
      title: t('featureShowcase.feature1.title'),
      description: t('featureShowcase.feature1.description'),
      color: "text-primary"
    },
    {
      icon: Shield,
      title: t('featureShowcase.feature2.title'),
      description: t('featureShowcase.feature2.description'),
      color: "text-accent"
    },
    {
      icon: Smartphone,
      title: t('featureShowcase.feature3.title'),
      description: t('featureShowcase.feature3.description'),
      color: "text-success"
    },
    {
      icon: Users,
      title: t('featureShowcase.feature4.title'),
      description: t('featureShowcase.feature4.description'),
      color: "text-warning"
    },
    {
      icon: Globe,
      title: t('featureShowcase.feature5.title'),
      description: t('featureShowcase.feature5.description'),
      color: "text-primary"
    },
    {
      icon: TrendingUp,
      title: t('featureShowcase.feature6.title'),
      description: t('featureShowcase.feature6.description'),
      color: "text-accent"
    },
    {
      icon: Clock,
      title: t('featureShowcase.feature7.title'),
      description: t('featureShowcase.feature7.description'),
      color: "text-success"
    },
    {
      icon: MessageSquare,
      title: t('featureShowcase.feature8.title'),
      description: t('featureShowcase.feature8.description'),
      color: "text-warning"
    },
    {
      icon: CreditCard,
      title: t('featureShowcase.feature9.title'),
      description: t('featureShowcase.feature9.description'),
      color: "text-primary"
    }
  ];

  return (
    <section className="py-20 md:py-24 bg-gradient-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            {t('featureShowcase.title')} <span className="bg-gradient-accent bg-clip-text text-transparent">{t('featureShowcase.titleHighlight')}</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            {t('featureShowcase.subtitle')}
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









