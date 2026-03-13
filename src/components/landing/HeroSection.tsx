import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Globe, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
const heroImage = "/images/hero-agriculture.jpg";

const HeroSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation('landing');

  const handleApplyClick = () => {
    if (user) {
      // User is logged in, redirect to projects or application form
      navigate("/opportunities");
    } else {
      // User not logged in, show toast and redirect to auth page
      toast({
        title: "Login Required",
        description: "Please log in or create an account to start applying for funding opportunities.",
        variant: "default",
      });
      navigate("/auth");
    }
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background Image with Parallax Effect */}
      <div className="absolute inset-0 z-0 bg-transparent">
        <img 
          src={heroImage}
          alt=""
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover animate-parallax"
          style={{ transform: 'scale(1.1)' }}
        />
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
      </div>

      {/* Animated Background Patterns */}
      <div className="absolute inset-0 opacity-10 z-10">
        <div className="absolute top-20 left-10 w-32 h-32 bg-primary rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-accent rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-warning rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left animate-fade-in">
            <div className="mb-4">
              <span className="inline-block px-4 py-2 bg-primary/20 backdrop-blur-sm rounded-full text-sm font-medium text-white border border-primary/30">
                {t('hero.badge')}
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6 text-white">
              {t('hero.headline1')}
              <span className="bg-gradient-hero bg-clip-text text-transparent"> {t('hero.headline2')} </span>
              <span className="text-white">{t('hero.headline3')}</span>
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-4 max-w-2xl leading-relaxed">
              {t('hero.subheadline')}
            </p>
            <p className="text-lg text-white/80 mb-8 max-w-2xl">
              {t('hero.description')}
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12 animate-scale-in" style={{ animationDelay: '0.3s' }}>
              <Button 
                variant="hero" 
                size="lg" 
                className="group bg-primary transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 animate-pulse-slow" 
                onClick={handleApplyClick}
              >
                {user ? t('hero.viewProjects') : t('hero.startApplication')}
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="group  text-primary  hover:text-primary transition-all duration-300 backdrop-blur-sm shadow-lg hover:shadow-xl hover:scale-105 animate-pulse-slow" 
                onClick={() => navigate("/opportunities")}
              >
                {t('hero.browseProjects')}
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-lg mx-auto lg:mx-0 animate-slide-in-right" style={{ animationDelay: '0.6s' }}>
              <div className="text-center lg:text-left bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-white/20">
                <div className="flex items-center justify-center lg:justify-start mb-1 sm:mb-2">
                  <Users className="h-5 sm:h-6 w-5 sm:w-6 text-success mr-2" />
                </div>
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-success mb-0.5 sm:mb-1">500+</div>
                <div className="text-xs sm:text-sm text-white/90 font-medium">{t('hero.entrepreneurs')}</div>
              </div>
              <div className="text-center lg:text-left bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-white/20">
                <div className="flex items-center justify-center lg:justify-start mb-1 sm:mb-2">
                  <Globe className="h-5 sm:h-6 w-5 sm:w-6 text-success mr-2" />
                </div>
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-success mb-0.5 sm:mb-1">25+</div>
                <div className="text-xs sm:text-sm text-white/90 font-medium">{t('hero.countries')}</div>
              </div>
              <div className="text-center lg:text-left bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-4 border border-white/20">
                <div className="flex items-center justify-center lg:justify-start mb-1 sm:mb-2">
                  <TrendingUp className="h-5 sm:h-6 w-5 sm:w-6 text-warning mr-2" />
                </div>
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-warning mb-0.5 sm:mb-1">$2M+</div>
                <div className="text-xs sm:text-sm text-white/90 font-medium">{t('hero.totalFunding')}</div>
              </div>
            </div>
          </div>

          {/* Right Content - Floating Cards */}
          <div className="hidden lg:block animate-fade-in" style={{ animationDelay: '0.9s' }}>
            <div className="relative">
              {/* Success Stories Cards */}
              <div className="absolute top-20 right-10 bg-card/90 backdrop-blur-sm p-6 rounded-xl shadow-elegant border border-white/20 animate-float max-w-xs">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-success rounded-full flex items-center justify-center">
                    <span className="text-success-foreground text-lg font-bold">âœ“</span>
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">Ahmed's Startup</div>
                    <div className="text-sm text-muted-foreground">$75K Funded</div>
                    <div className="text-xs text-success font-medium">Fintech Innovation</div>
                  </div>
                </div>
              </div>
              
              <div className="absolute bottom-10 left-5 bg-card/90 backdrop-blur-sm p-6 rounded-xl shadow-elegant border border-white/20 animate-float max-w-xs" style={{ animationDelay: '1.5s' }}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-primary-foreground text-lg font-bold">ðŸ’¡</span>
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">Kofi's Tech Hub</div>
                    <div className="text-sm text-muted-foreground">$120K Investment</div>
                    <div className="text-xs text-primary font-medium">EdTech Platform</div>
                  </div>
                </div>
              </div>

              <div className="absolute top-0 left-20 bg-card/90 backdrop-blur-sm p-6 rounded-xl shadow-elegant border border-white/20 animate-float max-w-xs" style={{ animationDelay: '2s' }}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
                    <span className="text-accent-foreground text-lg font-bold">ðŸš€</span>
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">Samuel's Venture</div>
                    <div className="text-sm text-muted-foreground">$200K Series A</div>
                    <div className="text-xs text-accent font-medium">E-commerce Solutions</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;









