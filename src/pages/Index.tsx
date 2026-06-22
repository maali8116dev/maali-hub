import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("landing");
  const siteUrl = getSiteUrl();

  return (
    <>
      <SEO
        title={t("seo.home.title")}
        description={t("seo.home.description")}
        url={siteUrl}
        type="website"
      />
      <StructuredData
        type="Organization"
        data={{
          name: "Maali Platform",
          url: siteUrl,
          description: t("seo.home.orgDescription"),
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
