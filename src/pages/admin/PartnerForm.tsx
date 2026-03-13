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
import { ImageUpload } from "@/components/ui/image-upload";
import { useImageUpload } from "@/hooks/useImageUpload";

const partnerSchema = z.object({
  name: z.string().min(1, "Name is required").min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  logo_url: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  website_url: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  sector: z.string().min(1, "Sector is required"),
  display_order: z.number().int().min(0),
  featured: z.boolean(),
  status: z.enum(["active", "inactive"]),
  user_id: z.string().optional().or(z.literal("")),
});

type PartnerFormValues = z.infer<typeof partnerSchema>;

type PartnerUser = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
};

const PartnerForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEditing = !!id;
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(isEditing);
  const [oldLogoUrl, setOldLogoUrl] = useState<string | null>(null);
  const [partnerUsers, setPartnerUsers] = useState<PartnerUser[]>([]);

  const { uploadImage, deleteImage, isUploading, uploadProgress } = useImageUpload({
    bucket: "partner-logos",
    maxSizeMB: 5,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      name: "",
      description: "",
      logo_url: "",
      website_url: "",
      sector: "Funding",
      display_order: 0,
      featured: false,
      status: "active",
      user_id: "",
    },
  });

  useEffect(() => {
    fetchPartnerUsers();
    if (isEditing && id) {
      fetchPartner();
    }
  }, [id, isEditing]);

  const fetchPartnerUsers = async () => {
    // Get all users with partner role
    const { data } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name")
      .eq("role", "partner");
    if (data) setPartnerUsers(data);
  };

  const fetchPartner = async () => {
    try {
      setIsFetching(true);
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .eq("id", parseInt(id!))
        .single();

      if (error) throw error;

      if (data) {
        setValue("name", data.name);
        setValue("description", data.description || "");
        setValue("logo_url", data.logo_url || "");
        setOldLogoUrl(data.logo_url);
        setValue("website_url", data.website_url || "");
        setValue("sector", data.sector);
        setValue("display_order", data.display_order ?? 0);
        setValue("featured", data.featured ?? false);
        setValue("status", data.status as PartnerFormValues["status"]);
        setValue("user_id", (data as any).user_id || "");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch partner",
        variant: "destructive",
      });
    } finally {
      setIsFetching(false);
    }
  };

  const onSubmit = async (data: PartnerFormValues) => {
    try {
      setIsLoading(true);

      // Delete old logo if it was changed and was from our storage
      if (isEditing && oldLogoUrl && oldLogoUrl !== data.logo_url && oldLogoUrl.includes('partner-logos')) {
        await deleteImage(oldLogoUrl);
      }

      const partnerData = {
        name: data.name,
        description: data.description || null,
        logo_url: data.logo_url || null,
        website_url: data.website_url || null,
        sector: data.sector,
        display_order: data.display_order,
        featured: data.featured,
        status: data.status,
        user_id: data.user_id || null,
      };

      if (isEditing && id) {
        const { error } = await supabase
          .from("partners")
          .update(partnerData)
          .eq("id", parseInt(id));

        if (error) throw error;

        toast({
          title: "Success",
          description: "Partner updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("partners")
          .insert([partnerData]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Partner created successfully",
        });
      }

      navigate("/admin/partners");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEditing ? "update" : "create"} partner`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logoUrl = watch("logo_url");
  // Partner sectors are fixed and defined in the database CHECK constraint
  const partnersectors = ['Funding', 'Support', 'Impact', 'Regional', 'Technology', 'Strategic'];

  if (isFetching) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading partner...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {isEditing ? "Edit Partner" : "Add New Partner"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isEditing ? "Update partner details" : "Fill in the details to add a new partner"}
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate("/admin/partners")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Partners
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Partner Information</CardTitle>
                <CardDescription>Enter the partner organization details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Partner Name *</Label>
                  <Input
                    id="name"
                    {...register("name")}
                    placeholder="Enter partner organization name"
                    className={errors.name ? "border-destructive" : ""}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...register("description")}
                    placeholder="Brief description of the partner organization"
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="logo_url">Partner Logo</Label>
                  <div className="space-y-4">
                    <ImageUpload
                      value={logoUrl || undefined}
                      onChange={(url) => setValue("logo_url", url || "")}
                      onUpload={uploadImage}
                      onDelete={async (url) => {
                        const deleted = await deleteImage(url);
                        if (deleted) {
                          setValue("logo_url", "");
                          setOldLogoUrl(null);
                        }
                        return deleted;
                      }}
                      isUploading={isUploading}
                      uploadProgress={uploadProgress}
                      placeholder="Upload Logo"
                      variant="banner"
                      className="w-full"
                    />
                    <div>
                      <Label htmlFor="logo_url_input" className="text-sm text-muted-foreground">
                        Or paste logo URL
                      </Label>
                      <Input
                        id="logo_url_input"
                        {...register("logo_url")}
                        placeholder="https://example.com/logo.png"
                        className={errors.logo_url ? "border-destructive" : ""}
                        disabled={isUploading}
                      />
                      {errors.logo_url && (
                        <p className="text-sm text-destructive mt-1">{errors.logo_url.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="website_url">Website URL</Label>
                  <Input
                    id="website_url"
                    {...register("website_url")}
                    placeholder="https://example.com"
                    className={errors.website_url ? "border-destructive" : ""}
                  />
                  {errors.website_url && (
                    <p className="text-sm text-destructive mt-1">{errors.website_url.message}</p>
                  )}
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
                  <Label htmlFor="sector">Sector *</Label>
                  <Select
                    value={watch("sector")}
                    onValueChange={(value) => setValue("sector", value as PartnerFormValues["sector"])}
                  >
                    <SelectTrigger id="sector">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {partnersectors.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
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

                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    value={watch("status")}
                    onValueChange={(value) => setValue("status", value as PartnerFormValues["status"])}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="featured">Featured Partner</Label>
                    <p className="text-xs text-muted-foreground">Highlight this partner</p>
                  </div>
                  <Switch
                    id="featured"
                    checked={watch("featured")}
                    onCheckedChange={(checked) => setValue("featured", checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Linked User Account */}
            <Card>
              <CardHeader>
                <CardTitle>Linked User Account</CardTitle>
                <CardDescription>Link this partner org to a user with the partner role</CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={watch("user_id") || ""}
                  onValueChange={(value) => setValue("user_id", value === "none" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a partner user..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked user</SelectItem>
                    {partnerUsers.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.first_name || ""} {u.last_name || ""} ({u.user_id.slice(0, 8)}...)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  Only users with the "partner" role are shown. Assign the partner role first via Users management.
                </p>
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
                      ? "Update Partner"
                      : "Create Partner"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate("/admin/partners")}
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

export default PartnerForm;









