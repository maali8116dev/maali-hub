import { useTranslation } from "react-i18next";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { QuickLinks } from "@/components/resources/QuickLinks";

const Help = () => {
  const { t } = useTranslation("landing");

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t("helpPage.title")}</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">{t("helpPage.subtitle")}</p>
        </div>
        <QuickLinks className="mt-0 pt-0 border-t-0" />
      </main>
      <Footer />
    </div>
  );
};

export default Help;
