import Navigation from "@/components/Navigation";
import HeroSection from "@/components/landing/HeroSection";
import TrustIndicators from "@/components/landing/TrustIndicators";
import HowItWorks from "@/components/landing/HowItWorks";
import FeaturedProjects from "@/components/landing/FeaturedProjects";
import Benefits from "@/components/landing/Benefits";
import FeatureShowcase from "@/components/landing/FeatureShowcase";
import Testimonials from "@/components/landing/Testimonials";
import Newsletter from "@/components/landing/Newsletter";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main>
        <HeroSection />
        <TrustIndicators />
        <HowItWorks />
        <FeaturedProjects />
        <Benefits />
        <FeatureShowcase />
        <Testimonials />
        <Newsletter />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
