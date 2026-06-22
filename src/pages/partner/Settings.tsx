import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUpload } from "@/components/ui/image-upload";
import CustomFormField, { FormFieldType } from "@/components/form/CustomFormField";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerOrg, useUpdatePartnerOrg, usePartnerOrgLinked, useIsPartnerOrgAdmin } from "@/hooks/usePartnerOrg";
import { useSectors } from "@/hooks/useSectors";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useToast } from "@/hooks/use-toast";
import { PartnerOrgRequiredAlert } from "@/components/partner/PartnerOrgRequiredAlert";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getLocalizedSectorName } from "@/lib/localizedSector";

type SettingsValues = {
  name: string;
  description?: string;
  website_url?: string;
  sector: string;
  contact_name?: string;
  contact_phone?: string;
  contact_country?: string;
  logo_url?: string;
};

const PartnerSettings = () => {
  const { user } = useAuth();
  const { t } = useTranslation(["dashboard", "common"]);
  const { data: partnerOrg, isLoading } = usePartnerOrg();
  const { isLinked, isLoading: isLoadingLink } = usePartnerOrgLinked();
  const canEditOrg = useIsPartnerOrgAdmin();
  const updatePartner = useUpdatePartnerOrg();
  const { toast } = useToast();
  const { data: sectors = [] } = useSectors();

  const settingsSchema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t("dashboard:partner.settingsPage.validation.nameRequired")),
        description: z.string().optional(),
        website_url: z.string().url(t("dashboard:partner.settingsPage.validation.validUrl")).or(z.literal("")).optional(),
        sector: z.string().min(1, t("dashboard:partner.settingsPage.validation.sectorRequired")),
        contact_name: z.string().optional(),
        contact_phone: z.string().optional(),
        contact_country: z.string().optional(),
        logo_url: z.string().optional(),
      }),
    [t]
  );

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
        title: t("dashboard:partner.settingsPage.toasts.updated"),
        description: t("dashboard:partner.settingsPage.toasts.updatedDesc"),
      });
    } catch (error: any) {
      toast({
        title: t("dashboard:partner.settingsPage.toasts.failed"),
        description: error.message || t("dashboard:partner.settingsPage.toasts.failedDesc"),
        variant: "destructive",
      });
    }
  };

  const logoUrl = form.watch("logo_url");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("dashboard:settings.title")}</h1>
        <p className="text-muted-foreground">{t("dashboard:partner.settingsPage.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard:partner.settingsPage.accountInfo.title")}</CardTitle>
          <CardDescription>{t("dashboard:partner.settingsPage.accountInfo.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="text-sm font-medium text-muted-foreground">{t("dashboard:partner.settingsPage.accountInfo.email")}</span>
            <p className="text-sm">{user?.email || "—"}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-muted-foreground">{t("dashboard:partner.settingsPage.accountInfo.role")}</span>
            <p className="text-sm">{t("common:status.role.partner")}</p>
          </div>
        </CardContent>
      </Card>

      <PartnerOrgRequiredAlert />

      {isLoading || isLoadingLink ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("dashboard:partner.settingsPage.loading")}</p>
          </CardContent>
        </Card>
      ) : !isLinked ? null : (
        <>
          {!canEditOrg && (
            <Alert>
              <AlertTitle>{t("dashboard:partner.settingsPage.readOnlyTitle")}</AlertTitle>
              <AlertDescription>{t("dashboard:partner.settingsPage.readOnlyDescription")}</AlertDescription>
            </Alert>
          )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard:partner.settingsPage.orgProfile.title")}</CardTitle>
                <CardDescription>{t("dashboard:partner.settingsPage.orgProfile.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <span className="text-sm font-medium">{t("dashboard:partner.settingsPage.orgProfile.logo")}</span>
                  <div className={!canEditOrg ? "pointer-events-none opacity-60" : undefined}>
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
                    placeholder={t("dashboard:partner.settingsPage.orgProfile.uploadLogo")}
                    variant="avatar"
                  />
                  </div>
                </div>

                <CustomFormField
                  control={form.control}
                  name="name"
                  label={t("dashboard:partner.settingsPage.orgProfile.name")}
                  fieldType={FormFieldType.INPUT}
                  placeholder={t("dashboard:partner.settingsPage.orgProfile.namePlaceholder")}
                  disabled={!canEditOrg}
                />

                <CustomFormField
                  control={form.control}
                  name="description"
                  label={t("dashboard:partner.settingsPage.orgProfile.descriptionLabel")}
                  fieldType={FormFieldType.TEXTAREA}
                  placeholder={t("dashboard:partner.settingsPage.orgProfile.descriptionPlaceholder")}
                  disabled={!canEditOrg}
                />

                <CustomFormField
                  control={form.control}
                  name="website_url"
                  label={t("dashboard:partner.settingsPage.orgProfile.website")}
                  fieldType={FormFieldType.INPUT}
                  placeholder={t("dashboard:partner.settingsPage.orgProfile.websitePlaceholder")}
                  disabled={!canEditOrg}
                />

                <FormField
                  control={form.control}
                  name="sector"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("dashboard:partner.settingsPage.orgProfile.sector")}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={!canEditOrg}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("dashboard:partner.settingsPage.orgProfile.sectorPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sectors.map((s) => (
                            <SelectItem key={s.id} value={s.name}>
                              {getLocalizedSectorName(s.name, t)}
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
                <CardTitle>{t("dashboard:partner.settingsPage.contact.title")}</CardTitle>
                <CardDescription>{t("dashboard:partner.settingsPage.contact.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CustomFormField
                  control={form.control}
                  name="contact_name"
                  label={t("dashboard:partner.settingsPage.contact.name")}
                  fieldType={FormFieldType.INPUT}
                  placeholder={t("dashboard:partner.settingsPage.contact.namePlaceholder")}
                  disabled={!canEditOrg}
                />

                <CustomFormField
                  control={form.control}
                  name="contact_phone"
                  label={t("dashboard:partner.settingsPage.contact.phone")}
                  fieldType={FormFieldType.INPUT}
                  placeholder={t("dashboard:partner.settingsPage.contact.phonePlaceholder")}
                  disabled={!canEditOrg}
                />

                <CustomFormField
                  control={form.control}
                  name="contact_country"
                  label={t("dashboard:partner.settingsPage.contact.country")}
                  fieldType={FormFieldType.INPUT}
                  placeholder={t("dashboard:partner.settingsPage.contact.countryPlaceholder")}
                  disabled={!canEditOrg}
                />
              </CardContent>
            </Card>

            {canEditOrg && (
            <div className="flex justify-end">
              <Button type="submit" disabled={updatePartner.isPending}>
                {updatePartner.isPending ? t("dashboard:settings.save.saving") : t("dashboard:settings.save.saveChanges")}
              </Button>
            </div>
            )}
          </form>
        </Form>
        </>
      )}
    </div>
  );
};

export default PartnerSettings;
