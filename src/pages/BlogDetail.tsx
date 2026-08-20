import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, User, Clock, Share2, Tag } from "lucide-react";

const BlogDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("landing");

  // Mock data - replace with API call when backend is ready
  const blogPost = {
    id: id ? parseInt(id) : 1,
    title: "10 Tips for Writing a Winning Funding Application",
    featuredImage: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=600&fit=crop",
    content: `
      <p>Writing a compelling funding application is crucial for securing the resources your business needs to grow. Here are ten essential tips to help you craft an application that stands out.</p>
      
      <h2>1. Start with a Clear Value Proposition</h2>
      <p>Your application should immediately communicate what makes your business unique and why it deserves funding. Clearly articulate your value proposition in the first paragraph.</p>
      
      <h2>2. Tell a Compelling Story</h2>
      <p>Funders want to understand not just what you do, but why you do it. Share your journey, the problem you're solving, and the impact you aim to create.</p>
      
      <h2>3. Provide Concrete Evidence</h2>
      <p>Back up your claims with data, metrics, and evidence. Show traction, customer testimonials, or market research that validates your business model.</p>
      
      <h2>4. Be Specific About Funding Use</h2>
      <p>Clearly outline how you'll use the funding. Break down expenses and explain how each allocation will drive growth and impact.</p>
      
      <h2>5. Demonstrate Market Opportunity</h2>
      <p>Show that you understand your market size, target audience, and competitive landscape. Prove there's a real opportunity for growth.</p>
      
      <h2>6. Highlight Your Team's Strengths</h2>
      <p>Funders invest in people as much as ideas. Showcase your team's expertise, experience, and commitment to the venture.</p>
      
      <h2>7. Address Risks Honestly</h2>
      <p>Don't ignore potential challenges. Acknowledge risks and explain how you plan to mitigate them. This shows maturity and planning.</p>
      
      <h2>8. Include Financial Projections</h2>
      <p>Provide realistic financial projections that show your path to sustainability and growth. Be conservative but optimistic.</p>
      
      <h2>9. Proofread and Polish</h2>
      <p>Errors and typos can undermine your credibility. Review your application multiple times and consider having others review it too.</p>
      
      <h2>10. Follow Instructions Carefully</h2>
      <p>Each funding opportunity has specific requirements. Make sure you follow all instructions, meet word limits, and submit required documents.</p>
      
      <p>Remember, a great funding application is clear, compelling, and complete. Take your time, be thorough, and don't hesitate to seek feedback before submitting.</p>
    `,
    excerpt: "Learn the key strategies that successful entrepreneurs use to craft compelling funding applications that stand out.",
    author: "Sarah Johnson",
    authorRole: "Funding Advisor",
    date: "January 15, 2024",
    sector: "Applications",
    readTime: "5 min read",
    featured: true,
    emoji: "📝",
    tags: ["Funding", "Applications", "Business Tips", "Entrepreneurship"]
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link to="/blog">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("blogPage.backToBlog")}
          </Button>
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-6">
            {blogPost.featured && <Badge variant="default">{t("blogPage.featured")}</Badge>}
            <Badge variant="outline">{blogPost.sector}</Badge>
          </div>

          <div className="relative w-full h-64 md:h-96 rounded-lg overflow-hidden mb-6">
            <img
              src={blogPost.featuredImage}
              alt={blogPost.title}
              className="w-full h-full object-cover"
            />
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">{blogPost.title}</h1>
          <p className="text-xl text-muted-foreground mb-6">{blogPost.excerpt}</p>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="font-medium">{blogPost.author}</span>
              {blogPost.authorRole && (
                <span className="text-xs">• {blogPost.authorRole}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{blogPost.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{blogPost.readTime}</span>
            </div>
          </div>

          {blogPost.tags && blogPost.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {blogPost.tags.map((tag, index) => (
                <Badge key={index} variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            {t("blogPage.shareArticle")}
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(blogPost.content) }}
            />
          </CardContent>
        </Card>

        <Card className="mt-8">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                {blogPost.author.charAt(0)}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-1">{blogPost.author}</h3>
                {blogPost.authorRole && (
                  <p className="text-sm text-muted-foreground mb-2">{blogPost.authorRole}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {t("blogPage.authorBio", { author: blogPost.author })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-8 bg-primary/5 border-primary/20">
          <CardContent className="pt-6 text-center">
            <h3 className="text-2xl font-bold mb-2">{t("blogPage.wantMoreTitle")}</h3>
            <p className="text-muted-foreground mb-4">{t("blogPage.wantMoreDesc")}</p>
            <Link to="/blog">
              <Button variant="hero">{t("blogPage.browseAll")}</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default BlogDetail;
