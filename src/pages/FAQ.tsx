import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search, HelpCircle } from "lucide-react";

const FAQ = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const faqCategories = [
    {
      category: "General",
      questions: [
        {
          question: "What is Maali?",
          answer: "Maali is a funding opportunity hub designed to connect African entrepreneurs with funding opportunities, resources, and support. We provide a platform where entrepreneurs can discover funding opportunities, submit applications, and track their progress."
        },
        {
          question: "Is Maali free to use?",
          answer: "Yes, creating an account and browsing opportunities on Maali is completely free. However, some funding opportunities may have application fees set by the funders themselves."
        },
        {
          question: "Which countries does Maali serve?",
          answer: "Maali serves entrepreneurs across all African countries. We work with funders and partners throughout the continent to provide opportunities for African entrepreneurs regardless of their location."
        }
      ]
    },
    {
      category: "Applications",
      questions: [
        {
          question: "How do I apply for funding?",
          answer: "To apply for funding, first browse our available opportunities on the Projects page. When you find an opportunity that matches your business, click 'Apply Now' and complete the multi-step application form. Make sure you have all required documents ready before starting."
        },
        {
          question: "What documents do I need to apply?",
          answer: "Required documents typically include: business registration documents, business plan, financial statements or projections, identification documents, and any sector-specific documents. Each opportunity may have slightly different requirements, which will be listed in the application form."
        },
        {
          question: "Can I save my application and complete it later?",
          answer: "Yes, you can save your application as a draft and return to complete it later. Your progress will be saved automatically, and you can access your draft applications from your dashboard."
        },
        {
          question: "How long does the review process take?",
          answer: "Review times vary depending on the funding opportunity and the number of applications received. Typically, initial reviews take 2-4 weeks, but some opportunities may take longer. You'll receive updates on your application status via email and in your dashboard."
        },
        {
          question: "Can I apply for multiple opportunities at once?",
          answer: "Yes, you can apply for multiple funding opportunities simultaneously. Each application is independent, and you can track all your applications from your dashboard."
        }
      ]
    },
    {
      category: "Payments",
      questions: [
        {
          question: "Are there application fees?",
          answer: "Application fees vary by opportunity. Some opportunities are free to apply for, while others may have a small application fee set by the funder. All fees are clearly displayed before you submit your application."
        },
        {
          question: "What payment methods do you accept?",
          answer: "We accept various payment methods including credit cards, mobile money, bank transfers, and PayPal. The available payment methods will be shown during the payment process."
        },
        {
          question: "Is my payment information secure?",
          answer: "Yes, all payments are processed securely through Stripe, a leading payment processor. We never store your full payment card details on our servers."
        }
      ]
    },
    {
      category: "Account & Profile",
      questions: [
        {
          question: "How do I create an account?",
          answer: "Click on 'Sign Up' in the navigation bar or visit the Auth page. You can create an account using your email address and password, or sign up with Google or Facebook for faster registration."
        },
        {
          question: "How do I update my profile?",
          answer: "You can update your profile information from your dashboard. Go to the Profile section to edit your personal details, business information, and upload documents."
        },
        {
          question: "What if I forget my password?",
          answer: "On the login page, click 'Forgot password?' and enter your email address. We'll send you a link to reset your password."
        }
      ]
    }
  ];

  const allQuestions = faqCategories.flatMap(cat =>
    cat.questions.map(q => ({ ...q, category: cat.category }))
  );

  const filteredQuestions = searchQuery
    ? allQuestions.filter(q =>
        q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.answer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allQuestions;

  const filteredCategories = searchQuery
    ? [{ category: "Search Results", questions: filteredQuestions }]
    : faqCategories;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <HelpCircle className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Frequently Asked Questions</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Find quick answers to the most common questions about using Maali.
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12"
            />
          </div>
        </div>

        {/* FAQ Accordion */}
        <div className="space-y-6 mb-12">
          {filteredCategories.map((category, categoryIndex) => (
            <Card key={categoryIndex}>
              <CardContent className="pt-6">
                <h2 className="text-2xl font-bold mb-4">{category.category}</h2>
                <Accordion type="single" collapsible className="w-full">
                  {category.questions.map((faq, faqIndex) => (
                    <AccordionItem key={faqIndex} value={`item-${categoryIndex}-${faqIndex}`}>
                      <AccordionTrigger className="text-left">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredQuestions.length === 0 && searchQuery && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No questions found matching your search.</p>
              <a href="/contact">
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                  Contact Support
                </button>
              </a>
            </CardContent>
          </Card>
        )}

        {/* Still Have Questions */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Still Have Questions?</h2>
              <p className="text-muted-foreground mb-4">
                Can't find the answer you're looking for? Our support team is here to help.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="/contact">
                  <button className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                    Contact Support
                  </button>
                </a>
                <a href="/help">
                  <button className="px-6 py-2 border border-border rounded-md hover:bg-muted transition-colors">
                    Visit Help Center
                  </button>
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default FAQ;

