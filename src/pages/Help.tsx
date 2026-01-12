import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, BookOpen, FileText, MessageCircle, Mail, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";

const Help = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const helpCategories = [
    {
      title: "Getting Started",
      icon: BookOpen,
      description: "New to Maali? Start here to learn the basics.",
      articles: [
        { title: "How to create an account", link: "#" },
        { title: "Understanding the platform", link: "#" },
        { title: "Your first steps", link: "#" }
      ]
    },
    {
      title: "Applications",
      icon: FileText,
      description: "Everything you need to know about applying for funding.",
      articles: [
        { title: "How to submit an application", link: "#" },
        { title: "Required documents", link: "#" },
        { title: "Application status tracking", link: "#" },
        { title: "Common application mistakes", link: "#" }
      ]
    },
    {
      title: "Account & Profile",
      icon: HelpCircle,
      description: "Manage your account settings and profile information.",
      articles: [
        { title: "Updating your profile", link: "#" },
        { title: "Changing your password", link: "#" },
        { title: "Account security", link: "#" }
      ]
    },
    {
      title: "Payments & Fees",
      icon: FileText,
      description: "Information about payment processing and fees.",
      articles: [
        { title: "Payment methods accepted", link: "#" },
        { title: "Understanding application fees", link: "#" },
        { title: "Payment troubleshooting", link: "#" }
      ]
    }
  ];

  const popularArticles = [
    { title: "How do I apply for funding?", category: "Applications" },
    { title: "What documents do I need?", category: "Applications" },
    { title: "How long does the review process take?", category: "Applications" },
    { title: "Can I edit my application after submission?", category: "Applications" },
    { title: "How do I track my application status?", category: "Applications" }
  ];

  const filteredCategories = searchQuery
    ? helpCategories.filter(category =>
        category.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        category.articles.some(article =>
          article.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : helpCategories;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Help Center</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Find answers to your questions and learn how to make the most of our platform.
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12"
            />
          </div>
        </div>

        {/* Popular Articles */}
        {!searchQuery && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Popular Articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {popularArticles.map((article, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{article.title}</h3>
                        <p className="text-sm text-muted-foreground">{article.category}</p>
                      </div>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Help Categories */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">
            {searchQuery ? "Search Results" : "Browse by Category"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredCategories.map((category, index) => {
              const Icon = category.icon;
              return (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <CardTitle>{category.title}</CardTitle>
                    </div>
                    <CardDescription>{category.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {category.articles.map((article, articleIndex) => (
                        <li key={articleIndex}>
                          <a
                            href={article.link}
                            className="text-sm text-primary hover:underline flex items-center justify-between"
                          >
                            <span>{article.title}</span>
                            <span>→</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {filteredCategories.length === 0 && searchQuery && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No articles found matching your search.</p>
              <Link to="/contact">
                <Button variant="outline">Contact Support</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Contact Support */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <CardTitle>Still Need Help?</CardTitle>
              </div>
              <CardDescription>
                Can't find what you're looking for? Our support team is here to help.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/contact">
                <Button variant="hero" className="w-full">
                  Contact Support
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Mail className="h-5 w-5 text-primary" />
                <CardTitle>Email Us</CardTitle>
              </div>
              <CardDescription>
                Send us an email and we'll get back to you within 24 hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a href="mailto:support@maali.africa">
                <Button variant="outline" className="w-full">
                  support@maali.africa
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Help;

