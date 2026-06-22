import { useState, useEffect, useMemo } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSectors } from "@/hooks/useSectors";
import { ImageUpload } from "@/components/ui/image-upload";
import { useImageUpload } from "@/hooks/useImageUpload";
import { PartnerLinkedUserCombobox, type PartnerLinkedUser } from "@/components/admin/PartnerLinkedUserCombobox";
import { BackButton } from "@/components/ui/back-button";
import { invokeWithAuth } from "@/lib/invokeWithAuth";
import { useTranslation } from "react-i18next";

type PartnerFormValues = {
  name: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  sector: string;
  display_order: number;
  featured: boolean;
  status: "active" | "inactive";
  user_id?: string;
  invite_email?: string;
};

const PartnerForm = () => {
  const { t, i18n } = useTranslation(["dashboard"]);
  const ff = "admin.cmsForm.partner";
  const fc = "admin.cmsForm.common";
  const fv = "admin.cmsForm.validation";

  const partnerSchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .min(1, t(`${fv}.required`, { field: t(`${ff}.name`) }))
          .min(2, t(`${fv}.nameMin2`)),
        description: z.string().optional(),
        logo_url: z.string().url(t(`${fv}.validUrl`)).optional().or(z.literal("")),
        website_url: z.string().url(t(`${fv}.validUrl`)).optional().or(z.literal("")),
        sector: z.string().min(1, t(`${fv}.required`, { field: t(`${ff}.sector`) })),
        display_order: z.number().int().min(0),
        featured: z.boolean(),
        status: z.enum(["active", "inactive"]),
        user_id: z.string().optional().or(z.literal("")),
        invite_email: z.string().email(t(`${fv}.validEmail`)).optional().or(z.literal("")),
      }),
    [t, i18n.language]
  );

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEditing = !!id;
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(isEditing);
  const [oldLogoUrl, setOldLogoUrl] = useState<string | null>(null);
  const [partnerUsers, setPartnerUsers] = useState<PartnerLinkedUser[]>([]);

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
      sector: "",
      display_order: 0,
      featured: false,
      status: "active",
      user_id: "",
      invite_email: "",
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
        setValue("sector", (data as any).sector ?? (data as any).Sector ?? "");
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

      // On create: if an invite email is provided and no user is manually linked,
      // call invite-partner to create the account and get the userId.
      let resolvedUserId = data.user_id || null;
      if (!isEditing && data.invite_email && !data.user_id) {
        // We don't have the partner org ID yet (not created), so pass null for partnerOrgId.
        // The org will be linked after insert below.
        const { data: inviteResult, error: inviteError } = await invokeWithAuth<{ userId: string }>(
          "invite-partner",
          { email: data.invite_email, partnerOrgName: data.name },
        );
        if (inviteError) throw new Error(inviteError.message || "Failed to send invite");
        resolvedUserId = inviteResult?.userId ?? null;
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
        user_id: resolvedUserId,
      };

      if (isEditing && id) {
        const { error } = await supabase
          .from("partners")
          .update(partnerData)
          .eq("id", parseInt(id));

        if (error) throw error;

        toast({ title: "Success", description: "Partner updated successfully" });
      } else {
        const { data: inserted, error } = await supabase
          .from("partners")
          .insert([partnerData])
          .select("id")
          .single();

        if (error) throw error;

        // If we sent an invite, update the partner row with the org ID so the
        // invite-partner edge function's org-link step can be skipped in future.
        // (The function already linked by userId; this is for completeness.)

        const inviteSent = !data.user_id && !!data.invite_email;
        toast({
          title: "Partner created",
          description: inviteSent
            ? `Partner created and invite sent to ${data.invite_email}.`
            : "Partner created successfully.",
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
  const { data: sectors = [] } = useSectors();

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
            {isEditing ? t(`${ff}.editTitle`) : t(`${ff}.createTitle`)}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isEditing ? t(`${ff}.editTitle`) : t(`${ff}.createTitle`)}
          </p>
        </div>
        <BackButton label={t(`${fc}.back`)} link="/admin/partners" />
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
                      {sectors.map((s) => (
                        <SelectItem key={s.id} value={s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              <CardContent className="space-y-4">
                {!isEditing && (
                  <div className="space-y-2">
                    <Label htmlFor="invite_email">Invite by email</Label>
                    <Input
                      id="invite_email"
                      type="email"
                      {...register("invite_email")}
                      placeholder="partner@example.com"
                      className={errors.invite_email ? "border-destructive" : ""}
                    />
                    {errors.invite_email && (
                      <p className="text-sm text-destructive">{errors.invite_email.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Creates an account with the partner role and sends a sign-in link. Leave blank to link an existing user below.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="partner-linked-user">
                    {isEditing ? "Partner user" : "Or link existing user"}
                  </Label>
                  <PartnerLinkedUserCombobox
                    id="partner-linked-user"
                    users={partnerUsers}
                    value={watch("user_id") || ""}
                    onValueChange={(userId) => setValue("user_id", userId)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Searchable list of users with the &quot;partner&quot; role only. Assign the role in Users management
                    if someone is missing.
                  </p>
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









