import { Separator } from "@/components/ui/separator";
import { Mail, Phone, MapPin, Facebook, Twitter, Linkedin, Instagram } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LEGAL_CONTACT } from "@/components/legal/legalContact";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { t } = useTranslation("footer");

  const footerLinks = {
    platform: [
      { labelKey: "browseOpportunities", href: "/opportunities" },
      { labelKey: "submitApplication", href: "/apply" },
      { labelKey: "trackStatus", href: "/dashboard" },
      { labelKey: "resources", href: "/resources" },
    ],
    company: [
      { labelKey: "aboutUs", href: "/about" },
      { labelKey: "ourPartners", href: "/partners" },
      { labelKey: "successStories", href: "/success-stories" },
      { labelKey: "blog", href: "/blog" },
    ],
    support: [
      { labelKey: "contactUs", href: "/contact" },
      { labelKey: "faq", href: "/faq" },
      { labelKey: "applicationGuide", href: "/guide" },
    ],
    legal: [
      { labelKey: "privacyPolicy", href: "/privacy" },
      { labelKey: "termsOfService", href: "/terms" },
      { labelKey: "cookiePolicy", href: "/cookies" },
      { labelKey: "dataProtection", href: "/data-protection" },
    ],
  } as const;

  const socialLinks = [
    { icon: Facebook, href: "#", label: "Facebook" },
    { icon: Twitter, href: "#", label: "Twitter" },
    { icon: Linkedin, href: "#", label: "LinkedIn" },
    { icon: Instagram, href: "#", label: "Instagram" },
  ];

  return (
    <footer className="bg-card border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-12">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-2">
              <h3 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-4">
                Maali
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md">{t("description")}</p>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <a href={`mailto:${LEGAL_CONTACT.email}`} className="hover:text-primary transition-colors">
                    {LEGAL_CONTACT.email}
                  </a>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  <a href={`tel:${LEGAL_CONTACT.phone.replace(/\s/g, "")}`} className="hover:text-primary transition-colors">
                    {LEGAL_CONTACT.phone}
                  </a>
                </div>
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{LEGAL_CONTACT.addressDisplay}</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div>
                  <h4 className="font-semibold mb-4 text-foreground">{t("platform")}</h4>
                  <ul className="space-y-3">
                    {footerLinks.platform.map((link) => (
                      <li key={link.labelKey}>
                        <a
                          href={link.href}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          {t(link.labelKey)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-4 text-foreground">{t("company")}</h4>
                  <ul className="space-y-3">
                    {footerLinks.company.map((link) => (
                      <li key={link.labelKey}>
                        <a
                          href={link.href}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          {t(link.labelKey)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-4 text-foreground">{t("support")}</h4>
                  <ul className="space-y-3">
                    {footerLinks.support.map((link) => (
                      <li key={link.labelKey}>
                        <a
                          href={link.href}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          {t(link.labelKey)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-4 text-foreground">{t("legal")}</h4>
                  <ul className="space-y-3">
                    {footerLinks.legal.map((link) => (
                      <li key={link.labelKey}>
                        <a
                          href={link.href}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          {t(link.labelKey)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {t("copyright", { year: currentYear, rights: t("allRightsReserved") })}
            </div>

            <div className="flex items-center gap-4">
              {socialLinks.map((social) => {
                const IconComponent = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    aria-label={social.label}
                  >
                    <IconComponent className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
