import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock, Eye, FileText } from "lucide-react";

const Privacy = () => {
  const sections = [
    {
      title: "Information We Collect",
      icon: FileText,
      content: [
        "Personal Information: Name, email address, phone number, and other contact details you provide when creating an account.",
        "Business Information: Company name, business registration details, financial information, and other business-related data you submit in applications.",
        "Usage Data: Information about how you interact with our platform, including pages visited, time spent, and features used.",
        "Technical Data: IP address, browser type, device information, and other technical data collected automatically."
      ]
    },
    {
      title: "How We Use Your Information",
      icon: Eye,
      content: [
        "To provide and improve our services, including processing applications and facilitating communication with funders.",
        "To personalize your experience and provide relevant funding opportunities.",
        "To communicate with you about your account, applications, and important updates.",
        "To analyze platform usage and improve our services.",
        "To comply with legal obligations and protect our rights."
      ]
    },
    {
      title: "Data Sharing and Disclosure",
      icon: Shield,
      content: [
        "We may share your application information with funding organizations when you apply for opportunities.",
        "We may share data with service providers who assist us in operating our platform, subject to confidentiality agreements.",
        "We may disclose information if required by law or to protect our rights and the rights of our users.",
        "We do not sell your personal information to third parties."
      ]
    },
    {
      title: "Data Security",
      icon: Lock,
      content: [
        "We implement industry-standard security measures to protect your data, including encryption and secure servers.",
        "Access to your personal information is restricted to authorized personnel only.",
        "While we strive to protect your data, no method of transmission over the internet is 100% secure.",
        "You are responsible for maintaining the confidentiality of your account credentials."
      ]
    },
    {
      title: "Your Rights",
      icon: FileText,
      content: [
        "Access: You can request access to the personal information we hold about you.",
        "Correction: You can update or correct your personal information through your account settings.",
        "Deletion: You can request deletion of your account and associated data, subject to legal and operational requirements.",
        "Objection: You can object to certain processing of your personal information.",
        "Data Portability: You can request a copy of your data in a portable format."
      ]
    },
    {
      title: "Cookies and Tracking",
      icon: Eye,
      content: [
        "We use cookies and similar technologies to enhance your experience and analyze platform usage.",
        "You can control cookie preferences through your browser settings.",
        "Some features may not function properly if cookies are disabled.",
        "For more information, please see our Cookie Policy."
      ]
    },
    {
      title: "Data Retention",
      icon: Lock,
      content: [
        "We retain your personal information for as long as necessary to provide our services and comply with legal obligations.",
        "Application data may be retained for longer periods to maintain records and support future opportunities.",
        "You can request deletion of your data at any time, subject to legal requirements."
      ]
    },
    {
      title: "International Data Transfers",
      icon: Shield,
      content: [
        "Your information may be transferred to and processed in countries other than your country of residence.",
        "We ensure appropriate safeguards are in place to protect your data during international transfers.",
        "By using our platform, you consent to the transfer of your information as described in this policy."
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground">
            Last updated: January 2024
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">
              At Maali, we are committed to protecting your privacy and ensuring the security of your personal information.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.
            </p>
            <p className="text-muted-foreground">
              By using Maali, you agree to the collection and use of information in accordance with this policy.
              If you do not agree with our policies and practices, please do not use our services.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6 mb-12">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Icon className="h-5 w-5 text-primary" />
                    <h2 className="text-2xl font-bold">{section.title}</h2>
                  </div>
                  <ul className="space-y-2">
                    {section.content.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start gap-2 text-muted-foreground">
                        <span className="text-primary mt-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
            <p className="text-muted-foreground mb-4">
              If you have any questions about this Privacy Policy or our data practices, please contact us:
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

export default Privacy;

