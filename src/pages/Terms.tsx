import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText } from "lucide-react";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card className="mb-6">
    <CardContent className="pt-6">
      <h2 className="text-xl font-bold mb-3">{title}</h2>
      <div className="text-muted-foreground space-y-2 text-sm leading-relaxed">{children}</div>
    </CardContent>
  </Card>
);

const Terms = () => {
  const [lang, setLang] = useState("en");

  return (
  <div className="min-h-screen bg-background">
    <Navigation />
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <FileText className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          {lang === "de" ? "Impressum" : "Legal Notice"}
        </h1>
        <p className="text-muted-foreground">
          {lang === "de" ? "Stand: April 2026" : "Last updated: April 2026"}
        </p>
      </div>

      <Tabs defaultValue="en" onValueChange={setLang}>
        <TabsList className="mb-8">
          <TabsTrigger value="en">English</TabsTrigger>
          <TabsTrigger value="de">Deutsch</TabsTrigger>
        </TabsList>

        <TabsContent value="en">
          <Section title="Company Information">
            <p>Maali.tech</p>
            <p>Techin Global UG (haftungsbeschränkt)</p>
            <p>Juri-Gagarin-Ring 132/92</p>
            <p>99084 Erfurt</p>
            <p>Germany</p>
            <p className="pt-2">Managing Director: Biluge Mushegera</p>
            <p>Commercial Register: HRB 521067</p>
            <p>Register Court: Jena Local Court</p>
            <p>Tax ID: 151 121/24516</p>
            <p className="pt-2">Phone: +49 361 21886352</p>
            <p>Email: <a href="mailto:info@maali.tech" className="text-primary underline">info@maali.tech</a></p>
          </Section>
          <Section title="Responsible for Content">
            <p>Biluge Mushegera</p>
            <p>Address as above</p>
          </Section>
          <Section title="Liability for Content">
            <p>We are responsible for our own content under applicable laws.</p>
            <p>We are not obliged to monitor third-party information.</p>
            <p>Content will be removed upon knowledge of violations.</p>
          </Section>
          <Section title="Liability for Links">
            <p>We are not responsible for external website content.</p>
          </Section>
          <Section title="Intellectual Property">
            <p>All content is protected by copyright law.</p>
          </Section>
          <Section title="Dispute Resolution">
            <p><a href="https://ec.europa.eu/consumers/odr" className="text-primary underline" target="_blank" rel="noreferrer">https://ec.europa.eu/consumers/odr</a></p>
            <p>We do not participate in dispute resolution.</p>
          </Section>
        </TabsContent>

        <TabsContent value="de">
          <Section title="Angaben gemäß § 5 DDG">
            <p>Maali.tech</p>
            <p>Techin Global UG (haftungsbeschränkt)</p>
            <p>Juri-Gagarin-Ring 132/92</p>
            <p>99084 Erfurt</p>
            <p>Deutschland</p>
            <p className="pt-2">Vertreten durch den Geschäftsführer: Biluge Mushegera</p>
            <p>Handelsregister: HRB 521067</p>
            <p>Registergericht: Amtsgericht Jena</p>
            <p>Steuernummer: 151 121/24516</p>
            <p className="pt-2">Telefon: +49 361 21886352</p>
            <p>E-Mail: <a href="mailto:info@maali.tech" className="text-primary underline">info@maali.tech</a></p>
          </Section>
          <Section title="Verantwortlich für Inhalte (§ 18 Abs. 2 MStV)">
            <p>Biluge Mushegera</p>
            <p>Anschrift wie oben</p>
          </Section>
          <Section title="Haftung für Inhalte">
            <p>Als Diensteanbieter sind wir gemäß § 7 DDG für eigene Inhalte verantwortlich.</p>
            <p>Wir sind nicht verpflichtet, fremde Inhalte zu überwachen (§§ 8–10 DDG).</p>
            <p>Bei Bekanntwerden von Rechtsverletzungen entfernen wir diese Inhalte umgehend.</p>
          </Section>
          <Section title="Haftung für Links">
            <p>Unsere Website enthält Links zu externen Websites. Für deren Inhalte sind ausschließlich deren Betreiber verantwortlich.</p>
          </Section>
          <Section title="Urheberrecht">
            <p>Alle Inhalte unterliegen dem deutschen Urheberrecht. Jede Nutzung außerhalb der gesetzlichen Grenzen bedarf der Zustimmung.</p>
          </Section>
          <Section title="Streitbeilegung">
            <p>EU-Plattform: <a href="https://ec.europa.eu/consumers/odr" className="text-primary underline" target="_blank" rel="noreferrer">https://ec.europa.eu/consumers/odr</a></p>
            <p>Wir nehmen nicht an Streitbeilegungsverfahren teil.</p>
          </Section>
        </TabsContent>
      </Tabs>
    </main>
    <Footer />
  </div>
  );
};

export default Terms;
