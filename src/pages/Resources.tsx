import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FileText, Video, Users, HelpCircle, Download, ExternalLink } from "lucide-react";

const Resources = () => {
  const resourceCategories = [
    {
      icon: FileText,
      title: "Application Guides",
      description: "Step-by-step guides to help you create winning applications",
      resources: [
        { title: "How to Write a Compelling Business Plan", type: "PDF", size: "2.3 MB" },
        { title: "Financial Projections Template", type: "Excel", size: "1.1 MB" },
        { title: "Pitch Deck Template", type: "PowerPoint", size: "5.2 MB" }
      ]
    },
    {
      icon: Video,
      title: "Video Tutorials",
      description: "Watch expert-led tutorials on funding applications",
      resources: [
        { title: "Application Walkthrough", type: "Video", duration: "15 min" },
        { title: "Common Mistakes to Avoid", type: "Video", duration: "8 min" },
        { title: "Success Stories", type: "Webinar", duration: "45 min" }
      ]
    },
    {
      icon: Users,
      title: "Mentorship",
      description: "Connect with experienced entrepreneurs and business leaders",
      resources: [
        { title: "Find a Mentor", type: "Directory" },
        { title: "Mentorship Guidelines", type: "PDF", size: "800 KB" },
        { title: "Monthly Mentor Sessions", type: "Event" }
      ]
    }
  ];

  const faqs = [
    {
      question: "What types of funding opportunities are available?",
      answer: "Maali offers various funding opportunities including grants, loans, equity investments, and hybrid funding models. These range from seed funding for early-stage startups to growth capital for scaling businesses."
    },
    {
      question: "Who is eligible to apply for funding?",
      answer: "Entrepreneurs and businesses across Africa are eligible to apply. We support both individual entrepreneurs and registered businesses at various stages of development, from idea stage to growth stage."
    },
    {
      question: "How long does the application process take?",
      answer: "The application process typically takes 4-8 weeks from submission to decision. This includes initial review, due diligence, and final approval processes."
    },
    {
      question: "What documents do I need to prepare?",
      answer: "Required documents typically include a business plan, financial statements, identification documents, business registration certificates (if applicable), and any relevant permits or licenses."
    },
    {
      question: "Is there an application fee?",
      answer: "Yes, there is a nominal application processing fee to ensure serious applications and cover administrative costs. The fee varies by funding amount and is clearly stated for each opportunity."
    },
    {
      question: "Can I apply for multiple opportunities?",
      answer: "Yes, you can apply for multiple funding opportunities as long as you meet the eligibility criteria for each. However, each application must be tailored to the specific opportunity."
    }
  ];

  const fundingTips = [
    "Start your application early - don't wait until the deadline",
    "Read all requirements carefully and ensure you meet eligibility criteria",
    "Prepare a clear and compelling business plan with realistic financial projections",
    "Highlight your unique value proposition and competitive advantages",
    "Demonstrate market demand and potential for growth",
    "Show how the funding will be used and the expected impact",
    "Provide evidence of your team's capabilities and experience",
    "Be honest about challenges and how you plan to address them"
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Resources & Support
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Everything you need to succeed in your funding journey
          </p>
        </div>

        {/* Resource Categories */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-8">Resource Library</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {resourceCategories.map((category, index) => (
              <Card key={index} className="hover:shadow-elegant transition-all duration-300">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <category.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{category.title}</CardTitle>
                  </div>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {category.resources.map((resource, resourceIndex) => (
                      <div key={resourceIndex} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{resource.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {resource.type} {resource.size && `• ${resource.size}`} {resource.duration && `• ${resource.duration}`}
                          </p>
                        </div>
                        <Button size="sm" variant="ghost">
                          {resource.type === "Directory" || resource.type === "Event" ? (
                            <ExternalLink className="h-4 w-4" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Funding Tips */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-8">Funding Success Tips</h2>
          <Card className="bg-gradient-subtle">
            <CardContent className="p-8">
              <div className="grid md:grid-cols-2 gap-6">
                {fundingTips.map((tip, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mt-0.5">
                      {index + 1}
                    </div>
                    <p className="text-muted-foreground">{tip}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-8">Frequently Asked Questions</h2>
          <Card>
            <CardContent className="p-6">
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center gap-3">
                        <HelpCircle className="h-5 w-5 text-primary" />
                        {faq.question}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pl-8">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>

        {/* Contact Support */}
        <div className="text-center bg-gradient-primary rounded-2xl p-8 md:p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">Need More Help?</h2>
          <p className="text-xl mb-8 opacity-90">
            Our support team is here to assist you every step of the way
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="secondary" size="lg">
              Contact Support
            </Button>
            <Button variant="outline" size="lg" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              Schedule a Call
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Resources;