import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Globe, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import heroImage from "@/assets/hero-agriculture.jpg";

const HeroSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleApplyClick = () => {
    if (user) {
      // User is logged in, redirect to projects or application form
      navigate("/projects");
    } else {
      // User not logged in, redirect to auth page
      navigate("/auth");
    }
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background Image with Parallax Effect */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat animate-parallax"
          style={{
            backgroundImage: `url(${heroImage})`,
            transform: 'scale(1.1)', // Slightly larger to prevent gaps during animation
          }}
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
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6 text-white">
              Empowering
              <span className="bg-gradient-hero bg-clip-text text-transparent"> African </span>
              <span className="text-white">Entrepreneurs</span>
            </h1>
            <p className="text-xl text-white/90 mb-8 max-w-2xl">
              Discover funding opportunities, submit applications, and connect with a thriving ecosystem of entrepreneurs across Africa. Your journey to success starts here.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12 animate-scale-in" style={{ animationDelay: '0.3s' }}>
              <Button variant="hero" size="lg" className="group bg-primary hover:bg-primary-dark transition-all duration-300" onClick={handleApplyClick}>
                {user ? "View Projects" : "Start Your Application"}
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-primary transition-all duration-300" onClick={() => navigate("/projects")}>
                Browse Projects
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 max-w-md mx-auto lg:mx-0 animate-slide-in-right" style={{ animationDelay: '0.6s' }}>
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start mb-2">
                  <Users className="h-5 w-5 text-accent mr-2" />
                </div>
                <div className="text-2xl font-bold text-accent">500+</div>
                <div className="text-sm text-white/80">Entrepreneurs</div>
              </div>
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start mb-2">
                  <Globe className="h-5 w-5 text-success mr-2" />
                </div>
                <div className="text-2xl font-bold text-success">25+</div>
                <div className="text-sm text-white/80">Countries</div>
              </div>
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start mb-2">
                  <TrendingUp className="h-5 w-5 text-warning mr-2" />
                </div>
                <div className="text-2xl font-bold text-warning">$2M+</div>
                <div className="text-sm text-white/80">Total Funding</div>
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
                    <span className="text-success-foreground text-lg font-bold">✓</span>
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
                    <span className="text-primary-foreground text-lg font-bold">💡</span>
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
                    <span className="text-accent-foreground text-lg font-bold">🚀</span>
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