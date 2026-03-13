import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock, FileCheck, AlertCircle, CheckCircle } from "lucide-react";

const DataProtection = () => {
  const rights = [
    {
      title: "Right to Access",
      icon: FileCheck,
      description: "You have the right to request access to the personal data we hold about you and receive a copy of that data."
    },
    {
      title: "Right to Rectification",
      icon: CheckCircle,
      description: "You can request correction of inaccurate or incomplete personal data at any time through your account settings."
    },
    {
      title: "Right to Erasure",
      icon: AlertCircle,
      description: "You can request deletion of your personal data, subject to legal and operational requirements that may require data retention."
    },
    {
      title: "Right to Restrict Processing",
      icon: Lock,
      description: "You can request that we limit how we use your personal data in certain circumstances."
    },
    {
      title: "Right to Data Portability",
      icon: FileCheck,
      description: "You can request a copy of your data in a structured, machine-readable format to transfer to another service."
    },
    {
      title: "Right to Object",
      icon: AlertCircle,
      description: "You can object to certain types of processing of your personal data, such as direct marketing."
    }
  ];

  const measures = [
    "Encryption of data in transit and at rest",
    "Regular security audits and vulnerability assessments",
    "Access controls and authentication mechanisms",
    "Employee training on data protection",
    "Incident response procedures",
    "Regular backups and disaster recovery plans"
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Data Protection & GDPR</h1>
          <p className="text-muted-foreground">
            Last updated: January 2024
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">
              At Maali, we are committed to protecting your personal data and respecting your privacy rights.
              This page provides information about our data protection practices and your rights under applicable
              data protection laws, including the General Data Protection Regulation (GDPR).
            </p>
            <p className="text-muted-foreground">
              We process your personal data in accordance with applicable data protection laws and our Privacy Policy.
              This page supplements our Privacy Policy with specific information about data protection and GDPR compliance.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6 mb-12">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">Legal Basis for Processing</h2>
              <p className="text-muted-foreground mb-4">
                We process your personal data based on the following legal grounds:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">-¢</span>
                  <span><strong>Contract:</strong> To fulfill our contract with you and provide our services</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">-¢</span>
                  <span><strong>Consent:</strong> When you have given clear consent for specific processing activities</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">-¢</span>
                  <span><strong>Legal Obligation:</strong> To comply with legal requirements and regulations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">-¢</span>
                  <span><strong>Legitimate Interests:</strong> For our legitimate business interests, balanced against your rights</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-6">Your Data Protection Rights</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {rights.map((right, index) => {
                  const Icon = right.icon;
                  return (
                    <div key={index} className="border border-border rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <Icon className="h-5 w-5 text-primary" />
                        <h3 className="font-bold">{right.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{right.description}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">Exercising Your Rights</h2>
              <p className="text-muted-foreground mb-4">
                To exercise any of your data protection rights, you can:
              </p>
              <ul className="space-y-2 text-muted-foreground mb-4">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">-¢</span>
                  <span>Use your account settings to update or delete certain information</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">-¢</span>
                  <span>Contact us at privacy@maali.africa with your request</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">-¢</span>
                  <span>Include sufficient information to verify your identity</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">-¢</span>
                  <span>Specify which right you wish to exercise</span>
                </li>
              </ul>
              <p className="text-sm text-muted-foreground">
                We will respond to your request within 30 days. If we need more time, we will inform you of the reason
                and the expected timeframe.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">Data Security Measures</h2>
              <p className="text-muted-foreground mb-4">
                We implement appropriate technical and organizational measures to protect your personal data against
                unauthorized access, alteration, disclosure, or destruction:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {measures.map((measure, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{measure}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">Data Breach Notification</h2>
              <p className="text-muted-foreground mb-4">
                In the event of a data breach that may affect your personal data, we will:
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">-¢</span>
                  <span>Notify relevant supervisory authorities within 72 hours, where required by law</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">-¢</span>
                  <span>Inform affected users without undue delay if the breach poses a high risk to their rights</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">-¢</span>
                  <span>Provide clear information about the nature of the breach and recommended actions</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">Data Protection Officer</h2>
              <p className="text-muted-foreground mb-4">
                We have appointed a Data Protection Officer (DPO) to oversee our data protection practices and ensure
                compliance with applicable data protection laws.
              </p>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm font-semibold mb-2">Contact our DPO:</p>
                <p className="text-sm text-muted-foreground">
                  <strong>Email:</strong> dpo@maali.africa<br />
                  <strong>Address:</strong> Nairobi, Kenya
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">Complaints</h2>
              <p className="text-muted-foreground mb-4">
                If you believe that we have not adequately addressed your data protection concerns, you have the right
                to lodge a complaint with your local data protection authority.
              </p>
              <p className="text-sm text-muted-foreground">
                For users in the European Union, you can contact your national data protection authority. For users in
                Kenya, you can contact the Office of the Data Protection Commissioner.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
            <p className="text-muted-foreground mb-4">
              For questions about data protection or to exercise your rights, please contact us:
            </p>
            <div className="space-y-2 text-muted-foreground">
              <p><strong>Email:</strong> privacy@maali.africa</p>
              <p><strong>Data Protection Officer:</strong> dpo@maali.africa</p>
              <p><strong>Address:</strong> Nairobi, Kenya</p>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default DataProtection;









