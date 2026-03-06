import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAllCategories } from "@/hooks/useCategories";

const successStorySchema = z.object({
  name: z.string().min(1, "Name is required").min(2, "Name must be at least 2 characters"),
  company: z.string().min(1, "Company is required").min(2, "Company must be at least 2 characters"),
  category: z.string().min(1, "Category is required"),
  location: z.string().min(1, "Location is required"),
  funding_amount: z.string().min(1, "Funding amount is required"),
  funding_date: z.string().min(1, "Funding date is required"),
  image_url: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  description: z.string().min(1, "Description is required").min(50, "Description must be at least 50 characters"),
  impact_metrics: z.string().optional(),
  featured: z.boolean(),
  display_order: z.number().int().min(0),
  status: z.enum(["draft", "published", "archived"]),
});

type SuccessStoryFormValues = z.infer<typeof successStorySchema>;

const SuccessStoryForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEditing = !!id;
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(isEditing);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<SuccessStoryFormValues>({
    resolver: zodResolver(successStorySchema),
    defaultValues: {
      name: "",
      company: "",
      category: "",
      location: "",
      funding_amount: "",
      funding_date: "",
      image_url: "",
      description: "",
      impact_metrics: "",
      featured: false,
      display_order: 0,
      status: "published",
    },
  });

  useEffect(() => {
    if (isEditing && id) {
      fetchStory();
    }
  }, [id, isEditing]);

  const fetchStory = async () => {
    try {
      setIsFetching(true);
      const { data, error } = await supabase
        .from("success_stories")
        .select("*")
        .eq("id", parseInt(id!))
        .single();

      if (error) throw error;

      if (data) {
        setValue("name", data.name);
        setValue("company", data.company);
        setValue("category", data.category);
        setValue("location", data.location);
        setValue("funding_amount", data.funding_amount);
        setValue("funding_date", data.funding_date);
        setValue("image_url", data.image_url || "");
        setValue("description", data.description);
        setValue("impact_metrics", data.impact_metrics || "");
        setValue("featured", data.featured);
        setValue("display_order", data.display_order);
        setValue("status", data.status as SuccessStoryFormValues["status"]);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch success story",
        variant: "destructive",
      });
    } finally {
      setIsFetching(false);
    }
  };

  const onSubmit = async (data: SuccessStoryFormValues) => {
    try {
      setIsLoading(true);

      const storyData = {
        name: data.name,
        company: data.company,
        category: data.category,
        location: data.location,
        funding_amount: data.funding_amount,
        funding_date: data.funding_date,
        image_url: data.image_url || null,
        description: data.description,
        impact_metrics: data.impact_metrics || null,
        featured: data.featured,
        display_order: data.display_order,
        status: data.status,
      };

      if (isEditing && id) {
        const { error } = await supabase
          .from("success_stories")
          .update(storyData)
          .eq("id", parseInt(id));

        if (error) throw error;

        toast({
          title: "Success",
          description: "Success story updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("success_stories")
          .insert([storyData]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Success story created successfully",
        });
      }

      navigate("/admin/success-stories");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEditing ? "update" : "create"} success story`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const imageUrl = watch("image_url");
  const { data: categoriesData = [] } = useAllCategories();
  const categories = categoriesData.map((cat) => cat.name);

  if (isFetching) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading success story...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {isEditing ? "Edit Success Story" : "Add New Success Story"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isEditing ? "Update success story details" : "Fill in the details to add a new success story"}
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate("/admin/success-stories")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Stories
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Story Information</CardTitle>
                <CardDescription>Enter the entrepreneur and company details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Entrepreneur Name *</Label>
                    <Input
                      id="name"
                      {...register("name")}
                      placeholder="Enter entrepreneur name"
                      className={errors.name ? "border-destructive" : ""}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="company">Company Name *</Label>
                    <Input
                      id="company"
                      {...register("company")}
                      placeholder="Enter company name"
                      className={errors.company ? "border-destructive" : ""}
                    />
                    {errors.company && (
                      <p className="text-sm text-destructive mt-1">{errors.company.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <Select
                      value={watch("category")}
                      onValueChange={(value) => setValue("category", value)}
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.length === 0 ? (
                          <SelectItem value="no-categories" disabled>No categories available</SelectItem>
                        ) : (
                          categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {errors.category && (
                      <p className="text-sm text-destructive mt-1">{errors.category.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="location">Location *</Label>
                    <Input
                      id="location"
                      {...register("location")}
                      placeholder="e.g., Lagos, Nigeria"
                      className={errors.location ? "border-destructive" : ""}
                    />
                    {errors.location && (
                      <p className="text-sm text-destructive mt-1">{errors.location.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="funding_amount">Funding Amount *</Label>
                    <Input
                      id="funding_amount"
                      {...register("funding_amount")}
                      placeholder="e.g., $50,000"
                      className={errors.funding_amount ? "border-destructive" : ""}
                    />
                    {errors.funding_amount && (
                      <p className="text-sm text-destructive mt-1">{errors.funding_amount.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="funding_date">Funding Date *</Label>
                    <Input
                      id="funding_date"
                      type="date"
                      {...register("funding_date")}
                      className={errors.funding_date ? "border-destructive" : ""}
                    />
                    {errors.funding_date && (
                      <p className="text-sm text-destructive mt-1">{errors.funding_date.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    {...register("description")}
                    placeholder="Describe the success story and impact..."
                    rows={6}
                    className={errors.description ? "border-destructive" : ""}
                  />
                  {errors.description && (
                    <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="impact_metrics">Impact Metrics</Label>
                  <Input
                    id="impact_metrics"
                    {...register("impact_metrics")}
                    placeholder="e.g., 500+ farmers supported, 40% yield increase"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Brief summary of the impact achieved
                  </p>
                </div>

                <div>
                  <Label htmlFor="image_url">Image URL</Label>
                  <div className="space-y-2">
                    <Input
                      id="image_url"
                      {...register("image_url")}
                      placeholder="https://example.com/image.jpg"
                      className={errors.image_url ? "border-destructive" : ""}
                    />
                    {errors.image_url && (
                      <p className="text-sm text-destructive mt-1">{errors.image_url.message}</p>
                    )}
                    {imageUrl && (
                      <div className="relative w-full h-48 rounded-lg overflow-hidden border bg-muted">
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
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    value={watch("status")}
                    onValueChange={(value) => setValue("status", value as SuccessStoryFormValues["status"])}
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

                <div>
                  <Label htmlFor="display_order">Display Order</Label>
                  <Input
                    id="display_order"
                    type="number"
                    {...register("display_order", { valueAsNumber: true })}
                    min="0"
                    className={errors.display_order ? "border-destructive" : ""}
                  />
                  {errors.display_order && (
                    <p className="text-sm text-destructive mt-1">{errors.display_order.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Lower numbers appear first
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="featured">Featured Story</Label>
                    <p className="text-xs text-muted-foreground">Highlight this story</p>
                  </div>
                  <Switch
                    id="featured"
                    checked={watch("featured")}
                    onCheckedChange={(checked) => setValue("featured", checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Button type="submit" className="w-full" disabled={isSubmitting || isLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSubmitting || isLoading
                      ? "Saving..."
                      : isEditing
                      ? "Update Story"
                      : "Create Story"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate("/admin/success-stories")}
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

export default SuccessStoryForm;

