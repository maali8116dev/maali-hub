import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, MapPin, Facebook, Twitter, Linkedin, Instagram, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNewsletterSubscribe } from "@/hooks/useNewsletterSubscribe";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { t } = useTranslation("landing");
  const [footerEmail, setFooterEmail] = useState("");
  const { subscribe, isSubmitting } = useNewsletterSubscribe();

  const footerLinks = {
    platform: [
      { label: "Browse Opportunities", href: "/opportunities" },
      { label: "Submit Application", href: "/apply" },
      { label: "Track Status", href: "/dashboard" },
      { label: "Resources", href: "/resources" }
    ],
    company: [
      { label: "About Us", href: "/about" },
      { label: "Our Partners", href: "/partners" },
      { label: "Success Stories", href: "/success-stories" },
      { label: "Blog", href: "/blog" }
    ],
    support: [
      // { label: "Help Center", href: "/help" },
      { label: "Contact Us", href: "/contact" },
      { label: "FAQ", href: "/faq" },
      { label: "Application Guide", href: "/guide" }
    ],
    legal: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Cookie Policy", href: "/cookies" },
      { label: "Data Protection", href: "/data-protection" }
    ]
  };

  const socialLinks = [
    { icon: Facebook, href: "#", label: "Facebook" },
    { icon: Twitter, href: "#", label: "Twitter" },
    { icon: Linkedin, href: "#", label: "LinkedIn" },
    { icon: Instagram, href: "#", label: "Instagram" }
  ];

  return (
    <footer className="bg-card border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-12">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Brand & Description */}
            <div className="lg:col-span-2">
              <h3 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-4">
                Maali
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Empowering African entrepreneurs through accessible funding opportunities and a supportive ecosystem. Join thousands of innovators building the future of Africa.
              </p>
              
              {/* Contact Info */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>info@maali.africa</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>+254 700 000 000</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>Nairobi, Kenya</span>
                </div>
              </div>

              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await subscribe(footerEmail, "footer");
                  if (ok) setFooterEmail("");
                }}
              >
                <h4 className="font-semibold text-sm">{t("newsletter.title")}</h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="email"
                    placeholder={t("newsletter.emailPlaceholder")}
                    value={footerEmail}
                    onChange={(e) => setFooterEmail(e.target.value)}
                    className="flex-1 min-h-[44px] sm:min-h-0"
                    required
                    disabled={isSubmitting}
                  />
                  <Button
                    type="submit"
                    variant="hero"
                    size="sm"
                    className="min-h-[44px] sm:min-h-0"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("newsletter.subscribe")}
                  </Button>
                </div>
              </form>

              {/* Payment Methods */}
              {/* <div className="space-y-3">
                <h4 className="font-semibold text-sm">We Accept</h4>
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs font-medium">
                    ðŸ’³ Credit Cards
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs font-medium">
                    ðŸ“± Mobile Money
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs font-medium">
                    ðŸ¦ Bank Transfer
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs font-medium">
                    ðŸ’° PayPal
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Secure payments powered by Stripe
                </p>
              </div> */}
            </div>

            {/* Footer Links */}
            <div className="lg:col-span-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div>
                  <h4 className="font-semibold mb-4 text-foreground">Platform</h4>
                  <ul className="space-y-3">
                    {footerLinks.platform.map((link) => (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-4 text-foreground">Company</h4>
                  <ul className="space-y-3">
                    {footerLinks.company.map((link) => (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-4 text-foreground">Support</h4>
                  <ul className="space-y-3">
                    {footerLinks.support.map((link) => (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-4 text-foreground">Legal</h4>
                  <ul className="space-y-3">
                    {footerLinks.legal.map((link) => (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          {link.label}
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

        {/* Bottom Footer */}
        <div className="py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
              © {currentYear} Maali. All rights reserved. Powered by TechNuru & GAT.
              {/* <div className="text-primary font-medium mt-1">
                Demo Application • Created by Dr. Wilfried Zoungrana
              </div> */}
            </div>
            
            {/* Social Links */}
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







