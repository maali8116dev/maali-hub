import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { CheckCircle, FileText, Upload, Eye, ArrowRight, Lightbulb, AlertCircle } from "lucide-react";

const Guide = () => {
  const steps = [
    {
      number: 1,
      title: "Create Your Account",
      description: "Start by creating a free account on Maali. You can sign up with your email or use Google for faster registration.",
      icon: CheckCircle,
      tips: [
        "Use a professional email address",
        "Choose a strong password",
        "Verify your email address promptly"
      ],
      action: "Sign up now"
    },
    {
      number: 2,
      title: "Complete Your Profile",
      description: "Fill out your profile with accurate business information. A complete profile increases your chances of approval.",
      icon: FileText,
      tips: [
        "Include detailed business information",
        "Upload a professional business logo",
        "Provide accurate contact information"
      ],
      action: "Go to Profile"
    },
    {
      number: 3,
      title: "Browse Opportunities",
      description: "Explore available funding opportunities. Use filters to find opportunities that match your business sector and needs.",
      icon: Eye,
      tips: [
        "Read opportunity descriptions carefully",
        "Check eligibility requirements",
        "Note application deadlines"
      ],
      action: "Browse Projects"
    },
    {
      number: 4,
      title: "Prepare Your Documents",
      description: "Gather all required documents before starting your application. This includes business plans, financial statements, and identification.",
      icon: Upload,
      tips: [
        "Business registration documents",
        "Financial statements or projections",
        "Business plan (if required)",
        "Identification documents",
        "Any sector-specific certificates"
      ],
      action: "View Requirements"
    },
    {
      number: 5,
      title: "Submit Your Application",
      description: "Complete the multi-step application form. Take your time to provide accurate and detailed information.",
      icon: CheckCircle,
      tips: [
        "Answer all questions thoroughly",
        "Double-check for errors before submitting",
        "Save your progress if you need to return later"
      ],
      action: "Start Application"
    },
    {
      number: 6,
      title: "Track Your Application",
      description: "Monitor your application status from your dashboard. You'll receive email notifications when there are updates.",
      icon: Eye,
      tips: [
        "Check your dashboard regularly",
        "Respond promptly to any requests for additional information",
        "Be patient during the review process"
      ],
      action: "View Dashboard"
    }
  ];

  const bestPractices = [
    {
      icon: Lightbulb,
      title: "Be Honest and Accurate",
      description: "Provide truthful information about your business. Misrepresentation can lead to application rejection or future issues."
    },
    {
      icon: FileText,
      title: "Prepare in Advance",
      description: "Gather all required documents before starting your application to avoid delays and ensure completeness."
    },
    {
      icon: CheckCircle,
      title: "Follow Instructions",
      description: "Read all instructions carefully and follow them precisely. Each opportunity may have specific requirements."
    },
    {
      icon: AlertCircle,
      title: "Meet Deadlines",
      description: "Submit your application well before the deadline to avoid last-minute issues and ensure your application is considered."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Application Guide</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            A step-by-step guide to help you successfully apply for funding opportunities on Maali.
          </p>
        </div>

        {/* Introduction */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              This guide will walk you through the entire application process, from creating your account
              to submitting your application. Follow these steps to maximize your chances of success.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Steps */}
        <div className="space-y-8 mb-12">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <Card key={step.number} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xl font-bold text-primary">{step.number}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-2xl">{step.title}</CardTitle>
                      </div>
                      <CardDescription className="text-base">{step.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="ml-16 space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Tips:</h4>
                      <ul className="space-y-1">
                        {step.tips.map((tip, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <Link to={step.number === 1 ? "/auth" : step.number === 2 ? "/dashboard/profile" : step.number === 3 ? "/projects" : step.number === 5 ? "/apply" : "/dashboard"}>
                        <Button variant="outline" size="sm">
                          {step.action}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Best Practices */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Best Practices</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {bestPractices.map((practice, index) => {
              const Icon = practice.icon;
              return (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{practice.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{practice.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Common Mistakes */}
        <Card className="mb-12 border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Common Mistakes to Avoid</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <span>Submitting incomplete applications or missing required documents</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <span>Waiting until the last minute to submit your application</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <span>Not reading the opportunity requirements carefully</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <span>Providing inaccurate or misleading information</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <span>Not responding to requests for additional information</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Additional Resources */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>Need More Help?</CardTitle>
            <CardDescription>
              Explore these additional resources to help you succeed with your application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link to="/faq">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  Frequently Asked Questions
                </Button>
              </Link>
              <Link to="/help">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  Help Center
                </Button>
              </Link>
              <Link to="/contact">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  Contact Support
                </Button>
              </Link>
              <Link to="/success-stories">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  Success Stories
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Guide;

