import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Globe, TrendingUp } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center bg-gradient-subtle overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-10 w-32 h-32 bg-primary rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-accent rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-warning rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left">
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
              Empowering
              <span className="bg-gradient-hero bg-clip-text text-transparent"> African </span>
              Entrepreneurs
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
              Discover funding opportunities, submit applications, and connect with a thriving ecosystem of entrepreneurs across Africa. Your journey to success starts here.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12">
              <Button variant="hero" size="lg" className="group">
                Start Your Application
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button variant="outline" size="lg">
                Browse Projects
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 max-w-md mx-auto lg:mx-0">
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start mb-2">
                  <Users className="h-5 w-5 text-primary mr-2" />
                </div>
                <div className="text-2xl font-bold text-primary">500+</div>
                <div className="text-sm text-muted-foreground">Entrepreneurs</div>
              </div>
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start mb-2">
                  <Globe className="h-5 w-5 text-accent mr-2" />
                </div>
                <div className="text-2xl font-bold text-accent">25+</div>
                <div className="text-sm text-muted-foreground">Countries</div>
              </div>
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start mb-2">
                  <TrendingUp className="h-5 w-5 text-success mr-2" />
                </div>
                <div className="text-2xl font-bold text-success">$2M+</div>
                <div className="text-sm text-muted-foreground">Funded</div>
              </div>
            </div>
          </div>

          {/* Right Content - Hero Image */}
          <div className="hidden lg:block">
            <div className="relative">
              <div className="w-full h-96 bg-gradient-primary rounded-2xl shadow-elegant overflow-hidden">
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <div className="text-white text-center">
                    <h3 className="text-2xl font-bold mb-2">African Innovation</h3>
                    <p className="text-white/90">Building the future together</p>
                  </div>
                </div>
              </div>
              
              {/* Floating Cards */}
              <div className="absolute -top-4 -left-4 bg-card p-4 rounded-lg shadow-soft border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center">
                    <span className="text-success-foreground text-sm font-bold">✓</span>
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Application Approved</div>
                    <div className="text-xs text-muted-foreground">Tech Startup Fund</div>
                  </div>
                </div>
              </div>
              
              <div className="absolute -bottom-4 -right-4 bg-card p-4 rounded-lg shadow-soft border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-primary-foreground text-sm font-bold">$</span>
                  </div>
                  <div>
                    <div className="font-semibold text-sm">$50K Funded</div>
                    <div className="text-xs text-muted-foreground">AgriTech Initiative</div>
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