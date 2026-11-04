import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Cookie } from "lucide-react";
import { useLegalLocale } from "@/hooks/useLegalLocale";
import { LegalLocalePanel } from "@/components/legal/LegalLocalePanel";
import { LEGAL_PAGE_META } from "@/components/legal/legalMeta";

const Cookies = () => {
  const legalLocale = useLegalLocale();
  const meta = LEGAL_PAGE_META.cookies[legalLocale];

  return (
  <div className="min-h-screen bg-background">
    <Navigation />
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <Cookie className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{meta.title}</h1>
        <p className="text-muted-foreground">{meta.updated}</p>
      </div>

      <LegalLocalePanel panels={{
        en: (
          <>
          <Card className="mb-6">
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-3">Necessary Cookies</h2>
              <p className="text-sm text-muted-foreground">
                Set on the basis of legitimate interest (Art. 6(1)(f) GDPR). Required for the platform to function and cannot be disabled.
              </p>
            </CardContent>
          </Card>
          <Card className="mb-6">
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-3">Optional Cookies</h2>
              <p className="text-sm text-muted-foreground">
                Optional cookies require your consent. Consent can be withdrawn at any time.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                For full details, see our <a href="/privacy" className="text-primary underline">Privacy Policy</a>.
              </p>
            </CardContent>
          </Card>
          </>
        ),
        fr: (
          <>
          <Card className="mb-6">
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-3">Cookies nécessaires</h2>
              <p className="text-sm text-muted-foreground">
                Fondés sur l'intérêt légitime (art. 6 par. 1 lit. f RGPD). Indispensables au fonctionnement de la plateforme et non désactivables.
              </p>
            </CardContent>
          </Card>
          <Card className="mb-6">
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-3">Cookies optionnels</h2>
              <p className="text-sm text-muted-foreground">
                Les cookies optionnels nécessitent votre consentement, que vous pouvez retirer à tout moment.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Pour plus de détails, consultez notre <a href="/privacy" className="text-primary underline">politique de confidentialité</a>.
              </p>
            </CardContent>
          </Card>
          </>
        ),
        pt: (
          <>
          <Card className="mb-6">
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-3">Cookies necessários</h2>
              <p className="text-sm text-muted-foreground">
                Com base no interesse legítimo (art. 6.º, n.º 1, al. f) RGPD). Necessários para o funcionamento da plataforma e não podem ser desativados.
              </p>
            </CardContent>
          </Card>
          <Card className="mb-6">
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-3">Cookies opcionais</h2>
              <p className="text-sm text-muted-foreground">
                Os cookies opcionais requerem o seu consentimento, que pode ser retirado a qualquer momento.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Para mais detalhes, consulte a nossa <a href="/privacy" className="text-primary underline">política de privacidade</a>.
              </p>
            </CardContent>
          </Card>
          </>
        ),
        de: (
          <>
          <Card className="mb-6">
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-3">Notwendige Cookies</h2>
              <p className="text-sm text-muted-foreground">
                Notwendig → Art. 6 Abs. 1 lit. f DSGVO. Für den Betrieb der Plattform erforderlich und nicht deaktivierbar.
              </p>
            </CardContent>
          </Card>
          <Card className="mb-6">
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-3">Optionale Cookies</h2>
              <p className="text-sm text-muted-foreground">
                Optional → Einwilligung erforderlich. Widerruf jederzeit möglich.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Weitere Details finden Sie in unserer <a href="/privacy" className="text-primary underline">Datenschutzerklärung</a>.
              </p>
            </CardContent>
          </Card>
          </>
        ),
      }} />
    </main>
    <Footer />
  </div>
  );
};

export default Cookies;
