import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cookie } from "lucide-react";

const Cookies = () => {
  const [lang, setLang] = useState("en");

  return (
  <div className="min-h-screen bg-background">
    <Navigation />
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <Cookie className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          {lang === "de" ? "Cookie-Richtlinie" : "Cookie Policy"}
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
        </TabsContent>

        <TabsContent value="de">
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
        </TabsContent>
      </Tabs>
    </main>
    <Footer />
  </div>
  );
};

export default Cookies;
