import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAllSectors } from "@/hooks/useSectors";
import { BackButton } from "@/components/ui/back-button";

const blogPostSchema = z.object({
  title: z.string().min(1, "Title is required").min(10, "Title must be at least 10 characters"),
  excerpt: z.string().min(1, "Excerpt is required").min(50, "Excerpt must be at least 50 characters"),
  content: z.string().min(1, "Content is required").min(100, "Content must be at least 100 characters"),
  author: z.string().min(1, "Author is required"),
  sector: z.string().min(1, "Sector is required"),
  readTime: z.string().min(1, "Read time is required"),
  image: z.string().min(1, "Image URL is required").url("Please enter a valid URL"),
  featured: z.boolean(),
  status: z.enum(["draft", "published", "archived"]),
  tags: z.string().optional(),
});

type BlogPostFormValues = z.infer<typeof blogPostSchema>;

const BlogForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  // Mock data - replace with API call when backend is ready
  const [initialData] = useState<BlogPostFormValues | null>(
    isEditing
      ? {
          title: "10 Tips for Writing a Winning Funding Application",
          excerpt: "Learn the key strategies that successful entrepreneurs use to craft compelling funding applications that stand out.",
          content: "Full article content here...",
          author: "Sarah Johnson",
          sector: "Applications",
          readTime: "5 min read",
          image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=600&fit=crop",
          featured: true,
          status: "published",
          tags: "Funding, Applications, Business Tips",
        }
      : null
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<BlogPostFormValues>({
    resolver: zodResolver(blogPostSchema),
    defaultValues: initialData || {
      title: "",
      excerpt: "",
      content: "",
      author: "",
      sector: "",
      readTime: "",
      image: "",
      featured: false,
      status: "draft",
      tags: "",
    },
  });

  const featured = watch("featured");
  const status = watch("status");
  const imageUrl = watch("image");

  useEffect(() => {
    if (initialData) {
      Object.keys(initialData).forEach((key) => {
        setValue(key as keyof BlogPostFormValues, initialData[key as keyof BlogPostFormValues]);
      });
    }
  }, [initialData, setValue]);

  const onSubmit = async (data: BlogPostFormValues) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("Blog post data:", data);
    
    // Navigate back to blog list after save
    navigate("/admin/blog");
  };

  const { data: sectorsData = [] } = useAllSectors();
  const sectors = sectorsData.map((cat) => cat.name);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {isEditing ? "Edit Blog Post" : "Create New Blog Post"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isEditing ? "Update blog post details" : "Fill in the details to create a new blog post"}
          </p>
        </div>
        <BackButton label="Back to Blog" link="/admin/blog" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Post Content</CardTitle>
                <CardDescription>Enter the main content for your blog post</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    {...register("title")}
                    placeholder="Enter blog post title"
                    className={errors.title ? "border-destructive" : ""}
                  />
                  {errors.title && (
                    <p className="text-sm text-destructive mt-1">{errors.title.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="excerpt">Excerpt *</Label>
                  <Textarea
                    id="excerpt"
                    {...register("excerpt")}
                    placeholder="Write a brief excerpt for the blog post"
                    rows={3}
                    className={errors.excerpt ? "border-destructive" : ""}
                  />
                  {errors.excerpt && (
                    <p className="text-sm text-destructive mt-1">{errors.excerpt.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="content">Content *</Label>
                  <Textarea
                    id="content"
                    {...register("content")}
                    placeholder="Write the full blog post content (HTML supported)"
                    rows={15}
                    className={errors.content ? "border-destructive" : ""}
                  />
                  {errors.content && (
                    <p className="text-sm text-destructive mt-1">{errors.content.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    You can use HTML tags for formatting
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Publish Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Publish Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    value={status}
                    onValueChange={(value) => setValue("status", value as "draft" | "published" | "archived")}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="featured">Featured Post</Label>
                    <p className="text-xs text-muted-foreground">Show this post as featured</p>
                  </div>
                  <Switch
                    id="featured"
                    checked={featured}
                    onCheckedChange={(checked) => setValue("featured", checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Post Details */}
            <Card>
              <CardHeader>
                <CardTitle>Post Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="image">Featured Image URL *</Label>
                  <div className="space-y-2">
                    <Input
                      id="image"
                      {...register("image")}
                      placeholder="https://example.com/image.jpg"
                      className={errors.image ? "border-destructive" : ""}
                    />
                    {errors.image && (
                      <p className="text-sm text-destructive mt-1">{errors.image.message}</p>
                    )}
                    {imageUrl && (
                      <div className="relative w-full h-32 rounded-lg overflow-hidden border">
                        <img
                          src={imageUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Enter a URL or upload an image (upload functionality coming soon)
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="author">Author *</Label>
                  <Input
                    id="author"
                    {...register("author")}
                    placeholder="Author name"
                    className={errors.author ? "border-destructive" : ""}
                  />
                  {errors.author && (
                    <p className="text-sm text-destructive mt-1">{errors.author.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="sector">Sector *</Label>
                  <Select
                    value={watch("sector")}
                    onValueChange={(value) => setValue("sector", value)}
                  >
                    <SelectTrigger id="sector">
                      <SelectValue placeholder="Select Sector" />
                    </SelectTrigger>
                    <SelectContent>
                      {sectors.length === 0 ? (
                        <SelectItem value="no-sectors" disabled>No sectors available</SelectItem>
                      ) : (
                        sectors.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {errors.sector && (
                    <p className="text-sm text-destructive mt-1">{errors.sector.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="readTime">Read Time *</Label>
                  <Input
                    id="readTime"
                    {...register("readTime")}
                    placeholder="e.g., 5 min read"
                    className={errors.readTime ? "border-destructive" : ""}
                  />
                  {errors.readTime && (
                    <p className="text-sm text-destructive mt-1">{errors.readTime.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="tags">Tags</Label>
                  <Input
                    id="tags"
                    {...register("tags")}
                    placeholder="Comma-separated tags"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Separate tags with commas
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSubmitting ? "Saving..." : isEditing ? "Update Post" : "Publish Post"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate("/admin/blog")}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
};

export default BlogForm;









