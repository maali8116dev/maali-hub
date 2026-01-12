import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Cookie, Settings, Eye, Shield } from "lucide-react";

const Cookies = () => {
  const cookieTypes = [
    {
      name: "Essential Cookies",
      icon: Shield,
      description: "These cookies are necessary for the platform to function properly. They enable core functionality such as security, network management, and accessibility.",
      examples: [
        "Authentication cookies to keep you logged in",
        "Security cookies to protect against fraud",
        "Session cookies to maintain your session"
      ],
      canDisable: false
    },
    {
      name: "Analytics Cookies",
      icon: Eye,
      description: "These cookies help us understand how visitors interact with our platform by collecting and reporting information anonymously.",
      examples: [
        "Page views and navigation patterns",
        "Time spent on pages",
        "Error tracking and performance monitoring"
      ],
      canDisable: true
    },
    {
      name: "Functional Cookies",
      icon: Settings,
      description: "These cookies enable enhanced functionality and personalization, such as remembering your preferences and settings.",
      examples: [
        "Language preferences",
        "Theme preferences (light/dark mode)",
        "Form data and application progress"
      ],
      canDisable: true
    },
    {
      name: "Marketing Cookies",
      icon: Cookie,
      description: "These cookies are used to deliver relevant advertisements and track the effectiveness of our marketing campaigns.",
      examples: [
        "Ad targeting and personalization",
        "Campaign performance tracking",
        "Social media integration"
      ],
      canDisable: true
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <Cookie className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Cookie Policy</h1>
          <p className="text-muted-foreground">
            Last updated: January 2024
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">
              This Cookie Policy explains how Maali uses cookies and similar technologies to recognize you when you visit
              our platform. It explains what these technologies are and why we use them, as well as your rights to control our use of them.
            </p>
            <p className="text-muted-foreground">
              By using Maali, you consent to the use of cookies in accordance with this policy. You can manage your cookie
              preferences through your browser settings or our cookie consent banner.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6 mb-12">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">What Are Cookies?</h2>
              <p className="text-muted-foreground mb-4">
                Cookies are small text files that are placed on your device when you visit a website. They are widely used
                to make websites work more efficiently and provide information to website owners.
              </p>
              <p className="text-muted-foreground">
                Cookies can be 'persistent' (remain on your device until deleted or expired) or 'session' cookies (deleted
                when you close your browser). We use both types of cookies on our platform.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">How We Use Cookies</h2>
              <p className="text-muted-foreground mb-6">
                We use cookies for various purposes, including:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>To enable core platform functionality and security</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>To remember your preferences and settings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>To analyze platform usage and improve our services</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>To provide personalized content and recommendations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>To track the effectiveness of our marketing campaigns</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-6">Types of Cookies We Use</h2>
              <div className="space-y-6">
                {cookieTypes.map((type, index) => {
                  const Icon = type.icon;
                  return (
                    <div key={index} className="border-b border-border pb-6 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3 mb-3">
                        <Icon className="h-5 w-5 text-primary" />
                        <h3 className="text-xl font-bold">{type.name}</h3>
                        {type.canDisable && (
                          <span className="text-xs bg-muted px-2 py-1 rounded">Optional</span>
                        )}
                      </div>
                      <p className="text-muted-foreground mb-3">{type.description}</p>
                      <div className="ml-8">
                        <p className="text-sm font-semibold mb-2">Examples:</p>
                        <ul className="space-y-1">
                          {type.examples.map((example, exampleIndex) => (
                            <li key={exampleIndex} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-primary mt-1">-</span>
                              <span>{example}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">Managing Cookies</h2>
              <p className="text-muted-foreground mb-4">
                You have the right to accept or reject cookies. Most web browsers automatically accept cookies, but you
                can usually modify your browser settings to decline cookies if you prefer.
              </p>
              <p className="text-muted-foreground mb-4">
                However, please note that disabling certain cookies may impact your experience on our platform. Some
                features may not function properly if cookies are disabled.
              </p>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm font-semibold mb-2">How to manage cookies in your browser:</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Chrome: Settings → Privacy and Security → Cookies</li>
                  <li>• Firefox: Options → Privacy & Security → Cookies</li>
                  <li>• Safari: Preferences → Privacy → Cookies</li>
                  <li>• Edge: Settings → Privacy → Cookies</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
            <p className="text-muted-foreground mb-4">
              If you have any questions about our use of cookies, please contact us:
            </p>
            <div className="space-y-2 text-muted-foreground">
              <p><strong>Email:</strong> privacy@maali.africa</p>
              <p><strong>Address:</strong> Nairobi, Kenya</p>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Cookies;

