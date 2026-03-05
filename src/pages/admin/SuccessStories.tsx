import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type SuccessStory = {
  id: number;
  name: string;
  company: string;
  category: string;
  location: string;
  funding_amount: string;
  funding_date: string;
  image_url: string | null;
  description: string;
  impact_metrics: string | null;
  featured: boolean;
  display_order: number;
  status: string;
  created_at: string;
  updated_at: string;
};

const AdminSuccessStories = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [storyToDelete, setStoryToDelete] = useState<number | null>(null);
  const [stories, setStories] = useState<SuccessStory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("success_stories")
        .select("*")
        .order("display_order", { ascending: true })
        .order("funding_date", { ascending: false });

      if (error) throw error;
      setStories(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch success stories",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStories = stories.filter((story) =>
    story.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    story.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    story.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (id: number) => {
    setStoryToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!storyToDelete) return;

    try {
      const { error } = await supabase
        .from("success_stories")
        .delete()
        .eq("id", storyToDelete);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Success story deleted successfully",
      });

      setStories(stories.filter((s) => s.id !== storyToDelete));
      setDeleteDialogOpen(false);
      setStoryToDelete(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete success story",
        variant: "destructive",
      });
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading success stories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Success Stories</h1>
          <p className="text-muted-foreground mt-2">
            Create, edit, and manage success stories
          </p>
        </div>
        <Button onClick={() => navigate("/admin/success-stories/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Add Story
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search stories by name, company, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stories List */}
      <Card>
        <CardHeader>
          <CardTitle>All Stories ({filteredStories.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredStories.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No success stories found</p>
              </div>
            ) : (
              filteredStories.map((story) => (
                <div
                  key={story.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                    {story.image_url ? (
                      <img
                        src={story.image_url}
                        alt={story.company}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).parentElement!.innerHTML = "🌟";
                        }}
                      />
                    ) : (
                      <span className="text-2xl">🌟</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{story.company}</h3>
                      {story.featured && <Badge variant="default">Featured</Badge>}
                      {getStatusBadge(story.status)}
                      <Badge variant="outline">{story.category}</Badge>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      {story.name}
                    </p>
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                      {story.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(story.funding_date).toLocaleDateString()}</span>
                      </div>
                      <span>{story.funding_amount}</span>
                      <span>{story.location}</span>
                      {story.impact_metrics && (
                        <span className="text-primary">{story.impact_metrics}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/admin/success-stories/${story.id}/edit`)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleDelete(story.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the success story.
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

export default AdminSuccessStories;

