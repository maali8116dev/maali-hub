import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUpload } from "@/components/ui/image-upload";
import CustomFormField, { FormFieldType } from "@/components/form/CustomFormField";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerOrg, useUpdatePartnerOrg } from "@/hooks/usePartnerOrg";
import { useSectors } from "@/hooks/useSectors";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useToast } from "@/hooks/use-toast";

const settingsSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  description: z.string().optional(),
  website_url: z.string().url("Please enter a valid URL").or(z.literal("")).optional(),
  sector: z.string().min(1, "Sector is required"),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_country: z.string().optional(),
  logo_url: z.string().optional(),
});

type SettingsValues = z.infer<typeof settingsSchema>;

const PartnerSettings = () => {
  const { user } = useAuth();
  const { data: partnerOrg, isLoading } = usePartnerOrg();
  const updatePartner = useUpdatePartnerOrg();
  const { toast } = useToast();
  const { data: sectors = [] } = useSectors();

  const { uploadImage, deleteImage, isUploading, uploadProgress } = useImageUpload({
    bucket: "partner-logos",
    folder: `partner-logos/${user?.id || ""}`,
    maxSizeMB: 5,
  });

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: "",
      description: "",
      website_url: "",
      sector: "",
      contact_name: "",
      contact_phone: "",
      contact_country: "",
      logo_url: "",
    },
  });

  useEffect(() => {
    if (partnerOrg) {
      form.reset({
        name: partnerOrg.name || "",
        description: partnerOrg.description || "",
        website_url: partnerOrg.website_url || "",
        sector: partnerOrg.sector || "",
        contact_name: partnerOrg.contact_name || "",
        contact_phone: partnerOrg.contact_phone || "",
        contact_country: partnerOrg.contact_country || "",
        logo_url: partnerOrg.logo_url || "",
      });
    }
  }, [partnerOrg, form]);

  const onSubmit = async (data: SettingsValues) => {
    try {
      await updatePartner.mutateAsync({
        name: data.name,
        description: data.description || null,
        website_url: data.website_url || null,
        logo_url: data.logo_url || null,
        sector: data.sector,
        contact_name: data.contact_name || null,
        contact_phone: data.contact_phone || null,
        contact_country: data.contact_country || null,
      });
      toast({
        title: "Partner profile updated",
        description: "Your organization details have been saved.",
      });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message || "Unable to save partner details.",
        variant: "destructive",
      });
    }
  };

  const logoUrl = form.watch("logo_url");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your partner account settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="text-sm font-medium text-muted-foreground">Email</span>
            <p className="text-sm">{user?.email || "—"}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-muted-foreground">Role</span>
            <p className="text-sm">Partner</p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Loading organization details...</p>
          </CardContent>
        </Card>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Organization Profile</CardTitle>
                <CardDescription>Update your organization information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <span className="text-sm font-medium">Organization Logo</span>
                  <ImageUpload
                    value={logoUrl || undefined}
                    onChange={(url) => form.setValue("logo_url", url || "")}
                    onUpload={uploadImage}
                    onDelete={async (url) => {
                      const ok = await deleteImage(url);
                      if (ok) form.setValue("logo_url", "");
                      return ok;
                    }}
                    isUploading={isUploading}
                    uploadProgress={uploadProgress}
                    placeholder="Upload Logo"
                    variant="avatar"
                  />
                </div>

                <CustomFormField
                  control={form.control}
                  name="name"
                  label="Organization Name"
                  fieldType={FormFieldType.INPUT}
                  placeholder="Organization name"
                />

                <CustomFormField
                  control={form.control}
                  name="description"
                  label="Description"
                  fieldType={FormFieldType.TEXTAREA}
                  placeholder="Brief description of your organization"
                />

                <CustomFormField
                  control={form.control}
                  name="website_url"
                  label="Website"
                  fieldType={FormFieldType.INPUT}
                  placeholder="https://your-website.com"
                />

                <FormField
                  control={form.control}
                  name="sector"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sector</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sector" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sectors.map((s) => (
                            <SelectItem key={s.id} value={s.name}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Details</CardTitle>
                <CardDescription>Primary contact for your organization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CustomFormField
                  control={form.control}
                  name="contact_name"
                  label="Primary Contact Name"
                  fieldType={FormFieldType.INPUT}
                  placeholder="Full name"
                />

                <CustomFormField
                  control={form.control}
                  name="contact_phone"
                  label="Business Phone (optional)"
                  fieldType={FormFieldType.INPUT}
                  placeholder="+1 234 567 890"
                />

                <CustomFormField
                  control={form.control}
                  name="contact_country"
                  label="Country / Region (optional)"
                  fieldType={FormFieldType.INPUT}
                  placeholder="e.g. Kenya"
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={updatePartner.isPending}>
                {updatePartner.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
};

export default PartnerSettings;
