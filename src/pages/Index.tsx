import Navigation from "@/components/Navigation";
import HeroSection from "@/components/landing/HeroSection";
import TrustIndicators from "@/components/landing/TrustIndicators";
import HowItWorks from "@/components/landing/HowItWorks";
import FeaturedProjects from "@/components/landing/FeaturedProjects";
import Benefits from "@/components/landing/Benefits";
import FeatureShowcase from "@/components/landing/FeatureShowcase";
import SuccessStoriesSection from "@/components/landing/SuccessStoriesSection";
import Newsletter from "@/components/landing/Newsletter";
import MembershipSection from "@/components/MembershipSection";
import Footer from "@/components/Footer";
import { SEO } from "@/components/seo/SEO";
import { StructuredData } from "@/components/seo/StructuredData";
import { getSiteUrl } from "@/utils/seo";

const Index = () => {
  const siteUrl = getSiteUrl();

  return (
    <>
      <SEO
        title="Empowering African Talent"
        description="Discover grants, jobs, internships, trainings, scholarships, and more. Apply with confidence and track outcomes on Africa's opportunity hub."
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
          description: "Empowering African talent through grants, jobs, internships, trainings, scholarships, and career opportunities",
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
          <MembershipSection />
          <TrustIndicators />
          <HowItWorks />
          <FeaturedProjects />
          <Benefits />
          <FeatureShowcase />
          <SuccessStoriesSection />
          <Newsletter />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;








