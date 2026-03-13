import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Eye, Calendar, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const AdminBlog = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<number | null>(null);

  // Mock data - replace with API calls when backend is ready
  const [blogPosts, setBlogPosts] = useState([
    {
      id: 1,
      title: "10 Tips for Writing a Winning Funding Application",
      excerpt: "Learn the key strategies that successful entrepreneurs use to craft compelling funding applications that stand out.",
      author: "Sarah Johnson",
      date: "2024-01-15",
      sector: "Applications",
      readTime: "5 min read",
      image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=400&fit=crop",
      featured: true,
      status: "published",
      views: 1250
    },
    {
      id: 2,
      title: "Understanding Different Types of Funding Opportunities",
      excerpt: "A comprehensive guide to grants, loans, equity, and other funding options available to African entrepreneurs.",
      author: "Michael Okafor",
      date: "2024-01-10",
      sector: "Funding",
      readTime: "8 min read",
      image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&h=400&fit=crop",
      featured: false,
      status: "published",
      views: 890
    },
    {
      id: 3,
      title: "Building a Sustainable Business in Africa",
      excerpt: "Explore strategies for creating businesses that not only succeed financially but also create positive social impact.",
      author: "Amina Diallo",
      date: "2024-01-05",
      sector: "Business",
      readTime: "6 min read",
      image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=400&fit=crop",
      featured: false,
      status: "draft",
      views: 0
    },
    {
      id: 4,
      title: "Success Story: How TechNuru Transformed a Startup",
      excerpt: "An in-depth look at how one entrepreneur used our platform to secure funding and scale their business.",
      author: "David Kofi",
      date: "2023-12-28",
      sector: "Success Stories",
      readTime: "10 min read",
      image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=400&fit=crop",
      featured: false,
      status: "published",
      views: 2100
    }
  ]);

  const filteredPosts = blogPosts.filter((post) =>
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.sector.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (id: number) => {
    setPostToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (postToDelete) {
      setBlogPosts(blogPosts.filter(post => post.id !== postToDelete));
      setDeleteDialogOpen(false);
      setPostToDelete(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <Badge className="bg-success text-success-foreground">Published</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "archived":
        return <Badge variant="outline">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Blog Posts</h1>
          <p className="text-muted-foreground mt-2">
            Create, edit, and manage blog articles
          </p>
        </div>
        <Button onClick={() => navigate("/admin/blog/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Create Post
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search posts by title, author, or sector..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Blog Posts List */}
      <Card>
        <CardHeader>
          <CardTitle>All Posts ({filteredPosts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold">{post.title}</h3>
                    {post.featured && <Badge variant="default">Featured</Badge>}
                    {getStatusBadge(post.status)}
                    <Badge variant="outline">{post.sector}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{post.author}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(post.date).toLocaleDateString()}</span>
                    </div>
                    <span>{post.readTime}</span>
                    <span>{post.views} views</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link to={`/blog/${post.id}`}>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => navigate(`/admin/blog/${post.id}/edit`)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-destructive"
                    onClick={() => handleDelete(post.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the blog post.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminBlog;









