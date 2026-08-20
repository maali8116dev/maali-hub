import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNewsletterSubscribe } from "@/hooks/useNewsletterSubscribe";

const Newsletter = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { t } = useTranslation("landing");
  const { subscribe, isSubmitting } = useNewsletterSubscribe();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await subscribe(email, "landing");
    if (ok) {
      setSubmitted(true);
      setEmail("");
      setTimeout(() => setSubmitted(false), 3000);
    }
  };

  return (
    <section className="py-20 md:py-24 bg-gradient-primary relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-white rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <Card className="border-0 shadow-2xl bg-card/95 backdrop-blur-sm">
          <CardContent className="p-8 md:p-12">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("newsletter.title")}</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t("newsletter.subtitle")}</p>
            </div>

            <form onSubmit={handleSubmit} className="max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row gap-4">
                <Input
                  type="email"
                  placeholder={t("newsletter.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                  required
                  disabled={isSubmitting}
                />
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="group"
                  disabled={isSubmitting || submitted}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : submitted ? (
                    <>
                      <Check className="mr-2 h-5 w-5" />
                      {t("newsletter.subscribed")}
                    </>
                  ) : (
                    <>
                      {t("newsletter.subscribe")}
                      <Mail className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground mt-4">{t("newsletter.privacy")}</p>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default Newsletter;
