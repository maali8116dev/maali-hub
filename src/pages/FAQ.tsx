import { useState, useMemo } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, HelpCircle } from "lucide-react";
import { useFAQs, FAQ } from "@/hooks/useFAQs";

const FAQPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: faqs, isLoading, error, refetch } = useFAQs();

  // Group FAQs by sector
  const faqsectors = useMemo(() => {
    if (!faqs) return [];
    
    const grouped = faqs.reduce((acc, faq) => {
      if (!acc[faq.sector]) {
        acc[faq.sector] = [];
      }
      acc[faq.sector].push(faq);
      return acc;
    }, {} as Record<string, FAQ[]>);

    return Object.entries(grouped)
      .map(([sector, questions]) => ({
        sector,
        questions: questions.sort((a, b) => a.display_order - b.display_order),
      }))
      .sort((a, b) => a.sector.localeCompare(b.sector));
  }, [faqs]);

  // Filter FAQs based on search
  const filteredsectors = useMemo(() => {
    if (!searchQuery) return faqsectors;

    const searchLower = searchQuery.toLowerCase();
    const matchingFAQs = faqs?.filter(
      (faq) =>
        faq.question.toLowerCase().includes(searchLower) ||
        faq.answer.toLowerCase().includes(searchLower)
    );

    if (!matchingFAQs || matchingFAQs.length === 0) return [];

    return [
      {
        sector: "Search Results",
        questions: matchingFAQs,
      },
    ];
  }, [searchQuery, faqs, faqsectors]);

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

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-6 mb-12">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-6 w-32 mb-4" />
                  <div className="space-y-3">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="border-b pb-3">
                        <Skeleton className="h-5 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="mb-12">
            <CardContent className="py-12 text-center">
              <p className="text-destructive mb-4">
                Failed to load FAQs. Please try again later.
              </p>
              <Button onClick={() => refetch()} variant="default">
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* FAQ Accordion */}
        {!isLoading && !error && (
          <div className="space-y-6 mb-12">
            {filteredsectors.map((sector, categoryIndex) => (
              <Card key={categoryIndex}>
                <CardContent className="pt-6">
                  <h2 className="text-2xl font-bold mb-4">{sector.sector}</h2>
                  <Accordion type="single" collapsible className="w-full">
                    {sector.questions.map((faq, faqIndex) => (
                      <AccordionItem key={faq.id} value={`item-${categoryIndex}-${faqIndex}`}>
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
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredsectors.length === 0 && (
          <Card className="mb-12">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? "No questions found matching your search."
                  : "No FAQs available at the moment."}
              </p>
              {searchQuery && (
                <a href="/contact">
                  <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                    Contact Support
                  </button>
                </a>
              )}
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
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a href="/contact" className="w-full sm:w-auto">
                  <button className="w-full px-6 py-3 min-h-[48px] bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                    Contact Support
                  </button>
                </a>
                <a href="/help" className="w-full sm:w-auto">
                  <button className="w-full px-6 py-3 min-h-[48px] border border-border rounded-md hover:bg-muted transition-colors">
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

export default FAQPage;








