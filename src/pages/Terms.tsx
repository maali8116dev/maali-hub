import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

const Terms = () => {
  const sections = [
    {
      title: "Acceptance of Terms",
      content: [
        "By accessing and using Maali, you accept and agree to be bound by these Terms of Service.",
        "If you do not agree to these terms, you must not use our platform.",
        "We reserve the right to modify these terms at any time, and such modifications will be effective immediately upon posting."
      ]
    },
    {
      title: "Use of the Platform",
      content: [
        "You must be at least 18 years old to use Maali.",
        "You are responsible for maintaining the confidentiality of your account credentials.",
        "You agree to provide accurate, current, and complete information when creating an account and submitting applications.",
        "You must not use the platform for any illegal or unauthorized purpose.",
        "You must not attempt to gain unauthorized access to any part of the platform."
      ]
    },
    {
      title: "User Accounts",
      content: [
        "You are responsible for all activities that occur under your account.",
        "You must notify us immediately of any unauthorized use of your account.",
        "We reserve the right to suspend or terminate accounts that violate these terms.",
        "You may not create multiple accounts to circumvent platform restrictions."
      ]
    },
    {
      title: "Applications and Funding",
      content: [
        "Maali is a platform that connects entrepreneurs with funding opportunities. We do not guarantee funding approval.",
        "Funding decisions are made by the funding organizations, not by Maali.",
        "Application fees, if any, are set by the funding organizations and are non-refundable.",
        "We are not responsible for the terms, conditions, or outcomes of funding agreements between users and funders.",
        "You are responsible for reviewing and understanding all terms associated with each funding opportunity."
      ]
    },
    {
      title: "Intellectual Property",
      content: [
        "All content on Maali, including text, graphics, logos, and software, is the property of Maali or its licensors.",
        "You may not reproduce, distribute, or create derivative works from our content without permission.",
        "You retain ownership of content you submit, but grant us a license to use it for platform operations.",
        "You must not submit content that infringes on the intellectual property rights of others."
      ]
    },
    {
      title: "Prohibited Activities",
      content: [
        "Submitting false, misleading, or fraudulent information.",
        "Impersonating another person or entity.",
        "Harassing, threatening, or abusing other users.",
        "Spamming or sending unsolicited communications.",
        "Attempting to interfere with platform security or functionality.",
        "Using automated systems to access the platform without authorization."
      ]
    },
    {
      title: "Limitation of Liability",
      content: [
        "Maali is provided 'as is' without warranties of any kind.",
        "We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform.",
        "We do not guarantee the accuracy, completeness, or usefulness of any information on the platform.",
        "Our total liability shall not exceed the amount you paid to us in the past 12 months."
      ]
    },
    {
      title: "Termination",
      content: [
        "We may terminate or suspend your account at any time for violation of these terms.",
        "You may terminate your account at any time through your account settings.",
        "Upon termination, your right to use the platform will immediately cease.",
        "Provisions that by their nature should survive termination will remain in effect."
      ]
    },
    {
      title: "Governing Law",
      content: [
        "These terms are governed by the laws of Kenya.",
        "Any disputes arising from these terms will be resolved in the courts of Kenya.",
        "If any provision is found to be unenforceable, the remaining provisions will remain in full effect."
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <FileText className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
          <p className="text-muted-foreground">
            Last updated: January 2024
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">
              Please read these Terms of Service carefully before using Maali. These terms govern your access to
              and use of our platform and services.
            </p>
            <p className="text-muted-foreground">
              By using Maali, you agree to comply with and be bound by these terms. If you do not agree to these terms,
              you must not use our services.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6 mb-12">
          {sections.map((section, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <h2 className="text-2xl font-bold mb-4">{section.title}</h2>
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
          ))}
        </div>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
            <p className="text-muted-foreground mb-4">
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <div className="space-y-2 text-muted-foreground">
              <p><strong>Email:</strong> legal@maali.africa</p>
              <p><strong>Address:</strong> Nairobi, Kenya</p>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Terms;









