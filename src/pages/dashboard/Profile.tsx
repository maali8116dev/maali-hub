import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Mail, Building, MapPin, Loader2, CheckCircle2, X } from "lucide-react";
import CustomFormField, { FormFieldType } from "@/components/form/CustomFormField";
import { KycVerificationSection } from "@/components/profile/KycVerificationSection";
import { MembershipProfileSection } from "@/components/profile/MembershipProfileSection";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  country: z.string().optional(),
  phoneNumber: z.string().optional(),
  businessName: z.string().optional(),
  bio: z.string().optional(),
  avatarUrl: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: profile, isLoading, error, refetch } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: kyc } = useKycVerification();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
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
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile. Please try again.",
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
          title: "Profile picture removed",
          description: "Your profile picture has been removed.",
        });
      } catch (error: any) {
        toast({
          title: "Warning",
          description: "Image deleted but failed to update profile. Please save your changes.",
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
              {error instanceof Error ? error.message : "Failed to load profile"}
            </p>
            <Button onClick={() => refetch()}>Retry</Button>
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
            <p className="text-muted-foreground mb-4">No profile found. Please create one.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const watchedValues = form.watch();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          Manage your profile information and preferences
        </p>
      </div>

      {/* Profile Overview Card */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Profile Overview</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold">
              {watchedValues.firstName || "User"} {watchedValues.lastName || ""}
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              {watchedValues.businessName || "No organization listed"}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {watchedValues.country || "No location"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 sm:space-y-6">

              {/* Profile Picture — not a CustomFormField, needs special upload handling */}
              <div className="space-y-2">
                <Label>Profile Picture</Label>
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
                  placeholder="Upload Profile Picture"
                  variant="avatar"
                />
                <p className="text-xs text-muted-foreground">
                  Upload a profile picture to personalize your account (JPG, PNG, WebP, GIF up to 5MB)
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CustomFormField
                  control={form.control}
                  name="firstName"
                  label="First Name"
                  fieldType={FormFieldType.INPUT}
                  placeholder="Enter your first name"
                  required
                />
                <CustomFormField
                  control={form.control}
                  name="lastName"
                  label="Last Name"
                  fieldType={FormFieldType.INPUT}
                  placeholder="Enter your last name"
                  required
                />
              </div>

              {/* Email — read-only, not part of the form schema */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    value={user?.email || ""}
                    disabled
                    className="pl-10 bg-muted h-11 sm:h-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              <CustomFormField
                control={form.control}
                name="country"
                label="Location/Country"
                fieldType={FormFieldType.INPUT}
                placeholder="City, Country"
                icon={MapPin}
              />

              <CustomFormField
                control={form.control}
                name="phoneNumber"
                label="Phone Number"
                fieldType={FormFieldType.PHONE_INTERNATIONAL}
                placeholder="Enter phone number"
              />

              <CustomFormField
                control={form.control}
                name="businessName"
                label="Organization, employer, or school"
                fieldType={FormFieldType.INPUT}
                placeholder="Company, university, NGO, or employer (optional)"
                icon={Building}
              />

              <CustomFormField
                control={form.control}
                name="bio"
                label="Bio"
                fieldType={FormFieldType.TEXTAREA}
                placeholder="Tell us about yourself — your work, studies, skills, or what you're looking for..."
                rows={4}
                description="Optional. Helps reviewers and programs understand your background (founder, professional, or intern)."
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
                  Cancel
                </Button>
                <Button type="submit" disabled={updateProfile.isPending} className="min-h-[44px]">
                  {updateProfile.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
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
          {
            label: "Basic Information",
            done: !!(profile.firstName && profile.lastName),
          },
          {
            label: "Contact Details",
            done: !!(profile.phoneNumber && profile.country),
          },
          {
            label: "Bio & Description",
            done: !!(profile.bio && profile.bio.trim().length > 0),
          },
          {
            label: "Identity Verification",
            done: kyc?.status === "verified",
            pending: kyc?.status === "pending",
          },
        ];
        const doneCount = completionItems.filter((i) => i.done).length;
        const percentage = Math.round((doneCount / completionItems.length) * 100);

        return (
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Profile Completion</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Overall Progress</span>
                  <span className="font-medium">{percentage}% Complete</span>
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
                          <CheckCircle2 className="h-4 w-4" /> Complete
                        </span>
                      ) : item.pending ? (
                        <span className="flex items-center gap-1 text-amber-600">
                          <X className="h-4 w-4" /> Pending Review
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <X className="h-4 w-4" /> Incomplete
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
