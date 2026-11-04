import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { useKycVerification } from "@/hooks/useKycVerification";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/ui/image-upload";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Mail, Building, Loader2, CheckCircle2, X } from "lucide-react";
import CustomFormField, { FormFieldType } from "@/components/form/CustomFormField";
import { KycVerificationSection } from "@/components/profile/KycVerificationSection";
import { MembershipProfileSection } from "@/components/profile/MembershipProfileSection";
import { COUNTRIES } from "@/components/application/form/countries";

const profileSchema = (t: (key: string) => string) =>
  z.object({
    firstName: z.string().min(1, t("dashboard:profilePage.validation.firstNameRequired")),
    lastName: z.string().min(1, t("dashboard:profilePage.validation.lastNameRequired")),
    country: z.string().optional(),
    phoneNumber: z.string().optional(),
    businessName: z.string().optional(),
    bio: z.string().optional(),
    avatarUrl: z.string().optional(),
  });

type ProfileFormValues = z.infer<ReturnType<typeof profileSchema>>;

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation(["dashboard", "common"]);
  const schema = useMemo(() => profileSchema(t), [t]);
  const { data: profile, isLoading, error, refetch } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: kyc } = useKycVerification();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      country: "",
      phoneNumber: "",
      businessName: "",
      bio: "",
      avatarUrl: "",
    },
  });

  // Image upload hook
  const { uploadImage, deleteImage, isUploading, uploadProgress } = useImageUpload({
    bucket: "user-avatars",
    folder: user?.id || "",
    maxSizeMB: 5,
  });

  // Seed form when profile loads
  useEffect(() => {
    if (profile) {
      form.reset({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        country: profile.country || "",
        phoneNumber: profile.phoneNumber || "",
        businessName: profile.businessName || "",
        bio: profile.bio || "",
        avatarUrl: profile.avatarUrl || "",
      });
    }
  }, [profile]);

  const handleSubmit = async (values: ProfileFormValues) => {
    try {
      await updateProfile.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        businessName: values.businessName,
        country: values.country,
        phoneNumber: values.phoneNumber || undefined,
        bio: values.bio,
        avatarUrl: values.avatarUrl && values.avatarUrl.trim() ? values.avatarUrl.trim() : undefined,
      });

      toast({
        title: t("dashboard:profilePage.toasts.updated"),
        description: t("dashboard:profilePage.toasts.updatedDesc"),
      });
    } catch (error: any) {
      toast({
        title: t("dashboard:profilePage.toasts.error"),
        description: error.message || t("dashboard:profilePage.toasts.updateFailed"),
        variant: "destructive",
      });
    }
  };

  // Handle image deletion — auto-save to DB
  const handleImageDelete = async (imageUrl: string) => {
    const deleted = await deleteImage(imageUrl);
    if (deleted) {
      form.setValue("avatarUrl", "");
      try {
        await updateProfile.mutateAsync({ avatarUrl: undefined });
        toast({
          title: t("dashboard:profilePage.toasts.avatarRemoved"),
          description: t("dashboard:profilePage.toasts.avatarRemovedDesc"),
        });
      } catch (error: any) {
        toast({
          title: t("dashboard:profilePage.toasts.warning"),
          description: t("dashboard:profilePage.toasts.avatarDeleteWarning"),
          variant: "destructive",
        });
      }
    }
    return deleted;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-destructive mb-4">
              {error instanceof Error ? error.message : t("dashboard:profilePage.errors.loadFailed")}
            </p>
            <Button onClick={() => refetch()}>{t("dashboard:profilePage.errors.retry")}</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No profile found
  if (!profile) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">{t("dashboard:profilePage.errors.notFound")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const watchedValues = form.watch();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{t("dashboard:profilePage.title")}</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          {t("dashboard:profilePage.subtitle")}
        </p>
      </div>

      {/* Profile Overview Card */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">{t("dashboard:profilePage.overview")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold">
              {watchedValues.firstName || t("dashboard:profilePage.defaultUser")} {watchedValues.lastName || ""}
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              {watchedValues.businessName || t("dashboard:profilePage.noOrganization")}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {watchedValues.country || t("dashboard:profilePage.noLocation")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">{t("dashboard:profilePage.personalInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 sm:space-y-6">

              {/* Profile Picture — not a CustomFormField, needs special upload handling */}
              <div className="space-y-2">
                <Label>{t("dashboard:profilePage.profilePicture")}</Label>
                <ImageUpload
                  value={
                    (watchedValues.avatarUrl && watchedValues.avatarUrl.trim()) ||
                    (profile?.avatarUrl && profile.avatarUrl.trim()) ||
                    undefined
                  }
                  onChange={(url) => form.setValue("avatarUrl", url || "")}
                  onUpload={uploadImage}
                  onDelete={handleImageDelete}
                  isUploading={isUploading}
                  uploadProgress={uploadProgress}
                  placeholder={t("dashboard:profilePage.uploadProfilePicture")}
                  variant="avatar"
                />
                <p className="text-xs text-muted-foreground">
                  {t("dashboard:profilePage.avatarHint")}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CustomFormField
                  control={form.control}
                  name="firstName"
                  label={t("dashboard:profilePage.fields.firstName")}
                  fieldType={FormFieldType.INPUT}
                  placeholder={t("dashboard:profilePage.fields.firstNamePlaceholder")}
                  required
                />
                <CustomFormField
                  control={form.control}
                  name="lastName"
                  label={t("dashboard:profilePage.fields.lastName")}
                  fieldType={FormFieldType.INPUT}
                  placeholder={t("dashboard:profilePage.fields.lastNamePlaceholder")}
                  required
                />
              </div>

              {/* Email — read-only, not part of the form schema */}
              <div className="space-y-2">
                <Label htmlFor="email">{t("dashboard:profilePage.fields.email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    value={user?.email || ""}
                    disabled
                    className="pl-10 bg-muted h-11 sm:h-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t("dashboard:profilePage.emailCannotChange")}</p>
              </div>

              <CustomFormField
                control={form.control}
                name="country"
                label={t("dashboard:profilePage.fields.country")}
                fieldType={FormFieldType.SELECT}
                placeholder={t("dashboard:profilePage.fields.countryPlaceholder")}
                options={COUNTRIES}
              />

              <CustomFormField
                control={form.control}
                name="phoneNumber"
                label={t("dashboard:profilePage.fields.phone")}
                fieldType={FormFieldType.PHONE_INTERNATIONAL}
                placeholder={t("dashboard:profilePage.fields.phonePlaceholder")}
              />

              <CustomFormField
                control={form.control}
                name="businessName"
                label={t("dashboard:profilePage.fields.businessName")}
                fieldType={FormFieldType.INPUT}
                placeholder={t("dashboard:profilePage.fields.businessNamePlaceholder")}
                icon={Building}
              />

              <CustomFormField
                control={form.control}
                name="bio"
                label={t("dashboard:profilePage.fields.bio")}
                fieldType={FormFieldType.TEXTAREA}
                placeholder={t("dashboard:profilePage.fields.bioPlaceholder")}
                rows={4}
                description={t("dashboard:profilePage.fields.bioDescription")}
              />

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 sm:gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() => {
                    form.reset({
                      firstName: profile.firstName || "",
                      lastName: profile.lastName || "",
                      country: profile.country || "",
                      phoneNumber: profile.phoneNumber || "",
                      businessName: profile.businessName || "",
                      bio: profile.bio || "",
                      avatarUrl: profile.avatarUrl || "",
                    });
                  }}
                >
                  {t("dashboard:profilePage.cancel")}
                </Button>
                <Button type="submit" disabled={updateProfile.isPending} className="min-h-[44px]">
                  {updateProfile.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("dashboard:profilePage.saving")}
                    </>
                  ) : (
                    t("dashboard:profilePage.saveChanges")
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <MembershipProfileSection />

      {/* Identity Verification */}
      <KycVerificationSection />

      {/* Profile Completion */}
      {(() => {
        const completionItems = [
          { label: t("dashboard:profilePage.items.basicInfo"), done: !!(profile.firstName && profile.lastName) },
          { label: t("dashboard:profilePage.items.contactDetails"), done: !!(profile.phoneNumber && profile.country) },
          { label: t("dashboard:profilePage.items.bio"), done: !!(profile.bio && profile.bio.trim().length > 0) },
          {
            label: t("dashboard:profilePage.items.identity"),
            done: kyc?.status === "verified",
            pending: kyc?.status === "pending",
          },
        ];
        const doneCount = completionItems.filter((i) => i.done).length;
        const percentage = Math.round((doneCount / completionItems.length) * 100);

        return (
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">{t("dashboard:profilePage.completion")}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("dashboard:profilePage.overallProgress")}</span>
                  <span className="font-medium">{t("dashboard:profilePage.percentComplete", { percentage })}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${percentage}%` }} />
                </div>
                <div className="space-y-2 text-sm">
                  {completionItems.map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-1">
                      <span>{item.label}</span>
                      {item.done ? (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" /> {t("dashboard:profilePage.status.complete")}
                        </span>
                      ) : item.pending ? (
                        <span className="flex items-center gap-1 text-amber-600">
                          <X className="h-4 w-4" /> {t("dashboard:profilePage.status.pendingReview")}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <X className="h-4 w-4" /> {t("dashboard:profilePage.status.incomplete")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
};

export default Profile;
