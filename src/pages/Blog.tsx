import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Calendar, User, ArrowRight, Tag } from "lucide-react";
import { Link } from "react-router-dom";

const Blog = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const blogPosts = [
    {
      id: 1,
      title: "10 Tips for Writing a Winning Funding Application",
      excerpt: "Learn the key strategies that successful entrepreneurs use to craft compelling funding applications that stand out.",
      author: "Sarah Johnson",
      date: "January 15, 2024",
      sector: "Applications",
      readTime: "5 min read",
      featured: true,
      image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=400&fit=crop"
    },
    {
      id: 2,
      title: "Understanding Different Types of Funding Opportunities",
      excerpt: "A comprehensive guide to grants, loans, equity, and other funding options available to African entrepreneurs.",
      author: "Michael Okafor",
      date: "January 10, 2024",
      sector: "Funding",
      readTime: "8 min read",
      featured: false,
      image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&h=400&fit=crop"
    },
    {
      id: 3,
      title: "Building a Sustainable Business in Africa",
      excerpt: "Explore strategies for creating businesses that not only succeed financially but also create positive social impact.",
      author: "Amina Diallo",
      date: "January 5, 2024",
      sector: "Business",
      readTime: "6 min read",
      featured: false,
      image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=400&fit=crop"
    },
    {
      id: 4,
      title: "Success Story: How TechNuru Transformed a Startup",
      excerpt: "An in-depth look at how one entrepreneur used our platform to secure funding and scale their business.",
      author: "David Kofi",
      date: "December 28, 2023",
      sector: "Success Stories",
      readTime: "10 min read",
      featured: false,
      image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=400&fit=crop"
    },
    {
      id: 5,
      title: "Financial Planning for Early-Stage Startups",
      excerpt: "Essential financial planning tips to help your startup navigate the early stages of growth and development.",
      author: "Fatima Hassan",
      date: "December 20, 2023",
      sector: "Finance",
      readTime: "7 min read",
      featured: false,
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop"
    },
    {
      id: 6,
      title: "Networking Strategies for African Entrepreneurs",
      excerpt: "Learn how to build meaningful connections and leverage your network to grow your business.",
      author: "James Mwangi",
      date: "December 15, 2023",
      sector: "Networking",
      readTime: "5 min read",
      featured: false,
      image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&h=400&fit=crop"
    }
  ];

  const sectors = Array.from(new Set(blogPosts.map(post => post.sector)));

  const filteredPosts = searchQuery
    ? blogPosts.filter(post =>
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : blogPosts;

  const featuredPost = blogPosts.find(post => post.featured);
  const regularPosts = blogPosts.filter(post => !post.featured);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Blog</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Insights, tips, and stories to help you succeed as an African entrepreneur.
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12"
            />
          </div>
        </div>

        {/* Featured Post */}
        {featuredPost && !searchQuery && (
          <Card className="mb-12 hover:shadow-md transition-shadow overflow-hidden">
            <div className="relative w-full h-64 md:h-80 overflow-hidden">
              <img
                src={featuredPost.image}
                alt={featuredPost.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <Badge variant="default">Featured</Badge>
                <Badge variant="outline">{featuredPost.sector}</Badge>
              </div>
            </div>
            <CardHeader>
              <CardTitle className="text-3xl mb-4">{featuredPost.title}</CardTitle>
              <CardDescription className="text-base">{featuredPost.excerpt}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>{featuredPost.author}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{featuredPost.date}</span>
                  </div>
                  <span>{featuredPost.readTime}</span>
                </div>
                <Link to={`/blog/${featuredPost.id}`}>
                  <Button variant="outline">
                    Read More
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* sectors */}
        {!searchQuery && (
          <div className="mb-8 flex flex-wrap gap-2 justify-center">
            {sectors.map((sector) => (
              <Badge key={sector} variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">
                <Tag className="h-3 w-3 mr-1" />
                {sector}
              </Badge>
            ))}
          </div>
        )}

        {/* Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {(searchQuery ? filteredPosts : regularPosts).map((post) => (
            <Card key={post.id} className="hover:shadow-md transition-shadow flex flex-col overflow-hidden">
              <div className="relative w-full h-48 overflow-hidden">
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2">
                  <Badge variant="outline" className="bg-background/80 backdrop-blur-sm">
                    {post.sector}
                  </Badge>
                </div>
              </div>
              <CardHeader className="flex-1">
                <CardTitle className="text-xl mb-2">{post.title}</CardTitle>
                <CardDescription>{post.excerpt}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>{post.author}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{post.date}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{post.readTime}</span>
                  <Link to={`/blog/${post.id}`}>
                    <Button variant="ghost" size="sm">
                      Read More
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredPosts.length === 0 && searchQuery && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No articles found matching your search.</p>
            </CardContent>
          </Card>
        )}

        {/* Newsletter CTA */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>Stay Updated</CardTitle>
            <CardDescription>
              Subscribe to our newsletter to get the latest articles and funding opportunities delivered to your inbox.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input placeholder="Enter your email" className="flex-1" />
              <Button variant="hero">Subscribe</Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Blog;









