import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield } from "lucide-react";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card className="mb-6">
    <CardContent className="pt-6">
      <h2 className="text-xl font-bold mb-3">{title}</h2>
      <div className="text-muted-foreground space-y-2 text-sm leading-relaxed">{children}</div>
    </CardContent>
  </Card>
);

const Privacy = () => {
  const [lang, setLang] = useState("en");

  return (
  <div className="min-h-screen bg-background">
    <Navigation />
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <Shield className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          {lang === "de" ? "Datenschutzerklärung" : "Privacy Policy"}
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
          <Section title="Controller">
            <p>Techin Global UG (haftungsbeschränkt)</p>
            <p>Biluge Mushegera</p>
            <p>Erfurt, Germany</p>
            <p>Email: info@maali.tech</p>
          </Section>
          <Section title="General Information">
            <p>Processing is carried out in accordance with GDPR.</p>
          </Section>
          <Section title="Data Processed">
            <ul className="list-disc list-inside space-y-1">
              <li>Personal data</li>
              <li>Contact data</li>
              <li>Usage data</li>
              <li>Technical data</li>
            </ul>
          </Section>
          <Section title="Purpose & Legal Basis">
            <ul className="list-disc list-inside space-y-1">
              <li>Website operation → Art. 6(1)(f) GDPR</li>
              <li>Communication → Art. 6(1)(b) GDPR</li>
              <li>Security → Art. 6(1)(f) GDPR</li>
              <li>Payments → Art. 6(1)(b) GDPR</li>
            </ul>
          </Section>
          <Section title="Server Logs">
            <p>Technical data is collected for security purposes.</p>
          </Section>
          <Section title="Contact">
            <p>Data is stored to process inquiries.</p>
          </Section>
          <Section title="Payments (Stripe)">
            <p>Processed via Stripe Payments Europe Ltd., Ireland.</p>
            <p>Data may be transferred to the US under Standard Contractual Clauses.</p>
          </Section>
          <Section title="Cookies">
            <ul className="list-disc list-inside space-y-1">
              <li>Necessary cookies</li>
              <li>Optional cookies with consent</li>
            </ul>
            <p>Consent can be withdrawn anytime.</p>
          </Section>
          <Section title="International Transfers">
            <p>Transfers occur under appropriate safeguards.</p>
          </Section>
          <Section title="Retention">
            <p>Data is stored only as long as necessary.</p>
          </Section>
          <Section title="Your Rights">
            <p>Access, correction, deletion, restriction, portability, objection.</p>
            <p>You may withdraw consent at any time.</p>
          </Section>
          <Section title="Complaint">
            <p>You may contact a supervisory authority in Germany.</p>
          </Section>
          <Section title="Security">
            <p>We implement appropriate safeguards.</p>
          </Section>
          <Section title="Automated Decisions">
            <p>No automated decision-making.</p>
          </Section>
          <Section title="Changes">
            <p>We may update this policy.</p>
          </Section>
        </TabsContent>

        <TabsContent value="de">
          <Section title="Verantwortlicher">
            <p>Techin Global UG (haftungsbeschränkt)</p>
            <p>Biluge Mushegera</p>
            <p>Juri-Gagarin-Ring 132/92, 99084 Erfurt, Deutschland</p>
            <p>E-Mail: info@maali.tech</p>
          </Section>
          <Section title="Allgemeine Hinweise">
            <p>Die Datenverarbeitung erfolgt gemäß DSGVO, BDSG und TTDSG.</p>
          </Section>
          <Section title="Verarbeitete Daten">
            <ul className="list-disc list-inside space-y-1">
              <li>Bestandsdaten</li>
              <li>Kontaktdaten</li>
              <li>Inhaltsdaten</li>
              <li>Nutzungsdaten</li>
              <li>Verbindungsdaten</li>
            </ul>
          </Section>
          <Section title="Zwecke & Rechtsgrundlagen">
            <ul className="list-disc list-inside space-y-1">
              <li>Websitebetrieb → Art. 6 Abs. 1 lit. f DSGVO</li>
              <li>Kontakt → Art. 6 Abs. 1 lit. b DSGVO</li>
              <li>Sicherheit → Art. 6 Abs. 1 lit. f DSGVO</li>
              <li>Zahlungen → Art. 6 Abs. 1 lit. b DSGVO</li>
            </ul>
          </Section>
          <Section title="Server-Logfiles">
            <p>Erhebung von IP-Adresse, Browser, Systemdaten zur Sicherstellung der IT-Sicherheit.</p>
          </Section>
          <Section title="Kontaktaufnahme">
            <p>Daten werden zur Bearbeitung von Anfragen gespeichert.</p>
          </Section>
          <Section title="Zahlungsdienstleister Stripe">
            <p>Stripe Payments Europe Ltd., Dublin, Irland</p>
            <p>Verarbeitet werden Zahlungs- und Transaktionsdaten.</p>
            <p>Rechtsgrundlage: Vertragserfüllung und berechtigtes Interesse.</p>
            <p>Datenübertragung in die USA auf Basis von Standardvertragsklauseln möglich.</p>
            <p><a href="https://stripe.com/privacy" className="text-primary underline" target="_blank" rel="noreferrer">https://stripe.com/privacy</a></p>
          </Section>
          <Section title="Cookies">
            <ul className="list-disc list-inside space-y-1">
              <li>Notwendig → Art. 6 Abs. 1 lit. f DSGVO</li>
              <li>Optional → Einwilligung erforderlich</li>
            </ul>
            <p>Widerruf jederzeit möglich.</p>
          </Section>
          <Section title="Drittlandübermittlung">
            <p>Datenübertragung erfolgt nur mit geeigneten Garantien (Art. 44 ff. DSGVO).</p>
          </Section>
          <Section title="Speicherdauer">
            <p>Nur so lange wie erforderlich oder gesetzlich vorgeschrieben.</p>
          </Section>
          <Section title="Rechte der Betroffenen">
            <p>Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch.</p>
            <p>Einwilligungen können jederzeit widerrufen werden.</p>
          </Section>
          <Section title="Beschwerderecht">
            <p>Thüringer Landesbeauftragter für den Datenschutz und die Informationsfreiheit</p>
          </Section>
          <Section title="Datensicherheit">
            <p>Technische und organisatorische Schutzmaßnahmen sind implementiert.</p>
          </Section>
          <Section title="Automatisierte Entscheidungen">
            <p>Keine automatisierte Entscheidungsfindung gemäß Art. 22 DSGVO.</p>
          </Section>
          <Section title="Änderungen">
            <p>Wir behalten uns Änderungen vor.</p>
          </Section>
        </TabsContent>
      </Tabs>

      <Card className="bg-primary/5 border-primary/20 mt-8">
        <CardContent className="pt-6">
          <h2 className="text-xl font-bold mb-3">Contact</h2>
          <p className="text-muted-foreground text-sm">Email: <a href="mailto:info@maali.tech" className="text-primary underline">info@maali.tech</a></p>
          <p className="text-muted-foreground text-sm">Tel: +49 361 21886352</p>
        </CardContent>
      </Card>
    </main>
    <Footer />
  </div>
  );
};

export default Privacy;
