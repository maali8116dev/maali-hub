import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { useLegalLocale } from "@/hooks/useLegalLocale";
import { LegalLocalePanel } from "@/components/legal/LegalLocalePanel";
import { LEGAL_PAGE_META } from "@/components/legal/legalMeta";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card className="mb-6">
    <CardContent className="pt-6">
      <h2 className="text-xl font-bold mb-3">{title}</h2>
      <div className="text-muted-foreground space-y-2 text-sm leading-relaxed">{children}</div>
    </CardContent>
  </Card>
);

const Privacy = () => {
  const legalLocale = useLegalLocale();
  const meta = LEGAL_PAGE_META.privacy[legalLocale];
  const contactTitle = legalLocale === "de" ? "Kontakt" : legalLocale === "fr" ? "Contact" : legalLocale === "pt" ? "Contacto" : "Contact";

  return (
  <div className="min-h-screen bg-background">
    <Navigation />
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <Shield className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{meta.title}</h1>
        <p className="text-muted-foreground">{meta.updated}</p>
      </div>

      <LegalLocalePanel panels={{
        en: (
          <>
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
          </>
        ),
        fr: (
          <>
          <Section title="Responsable du traitement">
            <p>Techin Global UG (haftungsbeschränkt)</p>
            <p>Biluge Mushegera</p>
            <p>Erfurt, Allemagne</p>
            <p>E-mail : info@maali.tech</p>
          </Section>
          <Section title="Informations générales">
            <p>Le traitement est effectué conformément au RGPD.</p>
          </Section>
          <Section title="Données traitées">
            <ul className="list-disc list-inside space-y-1">
              <li>Données personnelles</li>
              <li>Données de contact</li>
              <li>Données d'utilisation</li>
              <li>Données techniques</li>
            </ul>
          </Section>
          <Section title="Finalités et bases légales">
            <ul className="list-disc list-inside space-y-1">
              <li>Exploitation du site → art. 6 par. 1 lit. f RGPD</li>
              <li>Communication → art. 6 par. 1 lit. b RGPD</li>
              <li>Sécurité → art. 6 par. 1 lit. f RGPD</li>
              <li>Paiements → art. 6 par. 1 lit. b RGPD</li>
            </ul>
          </Section>
          <Section title="Journaux serveur">
            <p>Des données techniques sont collectées à des fins de sécurité.</p>
          </Section>
          <Section title="Contact">
            <p>Les données sont conservées pour traiter les demandes.</p>
          </Section>
          <Section title="Paiements (Stripe)">
            <p>Traitement via Stripe Payments Europe Ltd., Irlande.</p>
            <p>Transfert possible vers les États-Unis sur la base de clauses contractuelles types.</p>
          </Section>
          <Section title="Cookies">
            <ul className="list-disc list-inside space-y-1">
              <li>Cookies nécessaires</li>
              <li>Cookies optionnels avec consentement</li>
            </ul>
            <p>Le consentement peut être retiré à tout moment.</p>
          </Section>
          <Section title="Transferts internationaux">
            <p>Les transferts s'effectuent avec des garanties appropriées.</p>
          </Section>
          <Section title="Conservation">
            <p>Les données ne sont conservées que le temps nécessaire.</p>
          </Section>
          <Section title="Vos droits">
            <p>Accès, rectification, suppression, limitation, portabilité, opposition.</p>
            <p>Vous pouvez retirer votre consentement à tout moment.</p>
          </Section>
          <Section title="Réclamation">
            <p>Vous pouvez contacter une autorité de contrôle en Allemagne.</p>
          </Section>
          <Section title="Sécurité">
            <p>Nous mettons en œuvre des mesures de protection appropriées.</p>
          </Section>
          <Section title="Décisions automatisées">
            <p>Pas de prise de décision entièrement automatisée.</p>
          </Section>
          <Section title="Modifications">
            <p>Nous pouvons mettre à jour cette politique.</p>
          </Section>
          </>
        ),
        pt: (
          <>
          <Section title="Responsável pelo tratamento">
            <p>Techin Global UG (haftungsbeschränkt)</p>
            <p>Biluge Mushegera</p>
            <p>Erfurt, Alemanha</p>
            <p>E-mail: info@maali.tech</p>
          </Section>
          <Section title="Informação geral">
            <p>O tratamento é realizado em conformidade com o RGPD.</p>
          </Section>
          <Section title="Dados tratados">
            <ul className="list-disc list-inside space-y-1">
              <li>Dados pessoais</li>
              <li>Dados de contacto</li>
              <li>Dados de utilização</li>
              <li>Dados técnicos</li>
            </ul>
          </Section>
          <Section title="Finalidades e bases legais">
            <ul className="list-disc list-inside space-y-1">
              <li>Funcionamento do site → art. 6.º, n.º 1, al. f) RGPD</li>
              <li>Comunicação → art. 6.º, n.º 1, al. b) RGPD</li>
              <li>Segurança → art. 6.º, n.º 1, al. f) RGPD</li>
              <li>Pagamentos → art. 6.º, n.º 1, al. b) RGPD</li>
            </ul>
          </Section>
          <Section title="Registos do servidor">
            <p>Dados técnicos recolhidos para fins de segurança.</p>
          </Section>
          <Section title="Contacto">
            <p>Os dados são conservados para processar pedidos.</p>
          </Section>
          <Section title="Pagamentos (Stripe)">
            <p>Processamento via Stripe Payments Europe Ltd., Irlanda.</p>
            <p>Transferência possível para os EUA com base em cláusulas contratuais-tipo.</p>
          </Section>
          <Section title="Cookies">
            <ul className="list-disc list-inside space-y-1">
              <li>Cookies necessários</li>
              <li>Cookies opcionais com consentimento</li>
            </ul>
            <p>O consentimento pode ser retirado a qualquer momento.</p>
          </Section>
          <Section title="Transferências internacionais">
            <p>As transferências ocorrem com garantias adequadas.</p>
          </Section>
          <Section title="Conservação">
            <p>Os dados são conservados apenas pelo tempo necessário.</p>
          </Section>
          <Section title="Os seus direitos">
            <p>Acesso, retificação, eliminação, limitação, portabilidade, oposição.</p>
            <p>Pode retirar o consentimento a qualquer momento.</p>
          </Section>
          <Section title="Reclamação">
            <p>Pode contactar uma autoridade de controlo na Alemanha.</p>
          </Section>
          <Section title="Segurança">
            <p>Implementamos salvaguardas adequadas.</p>
          </Section>
          <Section title="Decisões automatizadas">
            <p>Sem tomada de decisão automatizada.</p>
          </Section>
          <Section title="Alterações">
            <p>Podemos atualizar esta política.</p>
          </Section>
          </>
        ),
        de: (
          <>
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
          </>
        ),
      }} />

      <Card className="bg-primary/5 border-primary/20 mt-8">
        <CardContent className="pt-6">
          <h2 className="text-xl font-bold mb-3">{contactTitle}</h2>
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
