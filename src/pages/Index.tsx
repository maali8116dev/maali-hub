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
import { SEO } from "@/components/seo/SEO";
import { StructuredData } from "@/components/seo/StructuredData";
import { getSiteUrl } from "@/utils/seo";

const Index = () => {
  const siteUrl = getSiteUrl();

  return (
    <>
      <SEO
        title="Empowering African Entrepreneurs"
        description="Discover funding opportunities, submit applications, and connect with a thriving ecosystem of entrepreneurs across Africa. Your journey to success starts here."
        // Keywords are optional - modern search engines ignore meta keywords
        // Focus on quality content, title, and description instead
        url={siteUrl}
        type="website"
      />
      <StructuredData
        type="Organization"
        data={{
          name: "Maali Platform",
          url: siteUrl,
          description: "Empowering African entrepreneurs through funding opportunities and business support",
        }}
        id="organization-schema"
      />
      <StructuredData
        type="WebSite"
        data={{
          name: "Maali Platform",
          url: siteUrl,
        }}
        id="website-schema"
      />
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
    </>
  );
};

export default Index;
