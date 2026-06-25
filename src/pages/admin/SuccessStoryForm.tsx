import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
import { useAllSectors } from "@/hooks/useSectors";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import {
  cmsTranslationFailureMessage,
  invalidateCmsTranslationQueries,
  triggerSuccessStoryTranslation,
} from "@/hooks/useTranslateCms";

type SuccessStoryFormValues = {
  name: string;
  company: string;
  sector: string;
  location: string;
  funding_amount: string;
  funding_date: string;
  image_url?: string;
  description: string;
  impact_metrics?: string;
  featured: boolean;
  display_order: number;
  status: "draft" | "published" | "archived";
};

const SuccessStoryForm = () => {
  const { t, i18n } = useTranslation(["dashboard"]);
  const ff = "admin.cmsForm.successStory";
  const fc = "admin.cmsForm.common";
  const fv = "admin.cmsForm.validation";

  const successStorySchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .min(1, t(`${fv}.required`, { field: t(`${ff}.name`) }))
          .min(2, t(`${fv}.nameMin2`)),
        company: z
          .string()
          .min(1, t(`${fv}.required`, { field: t(`${ff}.company`) }))
          .min(2, t(`${fv}.nameMin2`)),
        sector: z.string().min(1, t(`${fv}.required`, { field: t(`${ff}.sector`) })),
        location: z.string().min(1, t(`${fv}.required`, { field: t(`${ff}.location`) })),
        funding_amount: z.string().min(1, t(`${fv}.required`, { field: t(`${ff}.fundingAmount`) })),
        funding_date: z.string().min(1, t(`${fv}.required`, { field: t(`${ff}.fundingDate`) })),
        image_url: z.string().url(t(`${fv}.validUrl`)).optional().or(z.literal("")),
        description: z
          .string()
          .min(1, t(`${fv}.required`, { field: t(`${ff}.description`) }))
          .min(50, t(`${fv}.minChars`, { field: t(`${ff}.description`), min: 50 })),
        impact_metrics: z.string().optional(),
        featured: z.boolean(),
        display_order: z.number().int().min(0),
        status: z.enum(["draft", "published", "archived"]),
      }),
    [t, i18n.language]
  );

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
      sector: "",
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
        setValue("sector", data.sector);
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
        title: i18n.t("toasts.error", { ns: "common" }),
        description: error.message || i18n.t("toasts.successStory.fetchOneError", { ns: "common" }),
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
        sector: data.sector,
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

      let storyId: number;

      if (isEditing && id) {
        const { data: updated, error } = await supabase
          .from("success_stories")
          .update(storyData)
          .eq("id", parseInt(id))
          .select()
          .single();

        if (error) throw error;
        storyId = updated.id;

        toast({
          title: i18n.t("toasts.success", { ns: "common" }),
          description: i18n.t("toasts.successStory.updated", { ns: "common" }),
        });
      } else {
        const { data: created, error } = await supabase
          .from("success_stories")
          .insert([storyData])
          .select()
          .single();

        if (error) throw error;
        storyId = created.id;

        toast({
          title: i18n.t("toasts.success", { ns: "common" }),
          description: i18n.t("toasts.successStory.created", { ns: "common" }),
        });
      }

      void triggerSuccessStoryTranslation(storyId).then((result) => {
        if (!result.ok) {
          console.warn(cmsTranslationFailureMessage(result.reason));
        } else {
          invalidateCmsTranslationQueries(queryClient, "success_story");
        }
      });

      navigate("/admin/success-stories");
    } catch (error: any) {
      toast({
        title: i18n.t("toasts.error", { ns: "common" }),
        description: error.message || i18n.t(isEditing ? "toasts.successStory.updateError" : "toasts.successStory.createError", { ns: "common" }),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const imageUrl = watch("image_url");
  const { data: sectorsData = [] } = useAllSectors();
  const sectors = sectorsData.map((cat) => cat.name);

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
            {isEditing ? t(`${ff}.editTitle`) : t(`${ff}.createTitle`)}
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









