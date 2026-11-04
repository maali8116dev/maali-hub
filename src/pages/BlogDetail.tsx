import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, User, Clock, Share2, Tag, Loader2 } from "lucide-react";
import { useBlogPost } from "@/hooks/useBlogPosts";

const BlogDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("landing");
  const { data: blogPost, isLoading } = useBlogPost(id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!blogPost || blogPost.status !== "published") {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <p className="text-muted-foreground mb-6">Post not found.</p>
          <Link to="/blog">
            <Button variant="outline">{t("blogPage.backToBlog")}</Button>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const tags = blogPost.tags
    ? blogPost.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
    : [];
  const dateLabel = new Date(blogPost.published_at || blogPost.created_at).toLocaleDateString();

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

          <div className="relative w-full h-64 md:h-96 rounded-lg overflow-hidden mb-6 bg-muted">
            {blogPost.image_url ? (
              <img
                src={blogPost.image_url}
                alt={blogPost.title}
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">{blogPost.title}</h1>
          <p className="text-xl text-muted-foreground mb-6">{blogPost.excerpt}</p>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="font-medium">{blogPost.author}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{dateLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{blogPost.read_time}</span>
            </div>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline">
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
