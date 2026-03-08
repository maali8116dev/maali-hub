import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/ui/image-upload";
import { useImageUpload } from "@/hooks/useImageUpload";
import { User, Mail, Building, Phone, MapPin, Loader2 } from "lucide-react";
import { KycVerificationSection } from "@/components/profile/KycVerificationSection";

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: profile, isLoading, error } = useProfile();
  const updateProfile = useUpdateProfile();
  
  // Local form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    bio: "",
    businessName: "",
    country: "",
    avatarUrl: "",
  });

  // Image upload hook
  const { uploadImage, deleteImage, isUploading, uploadProgress } = useImageUpload({
    bucket: "user-avatars",
    folder: user?.id || "",
    maxSizeMB: 5,
  });

  // Helper to access profile fields (handles both camelCase from API and snake_case from Supabase)
  const getProfileField = (camelCase: string, snake_case: string) => {
    if (!profile) return "";
    return (profile as any)[camelCase] || (profile as any)[snake_case] || "";
  };

  // Update form data when profile loads
  useEffect(() => {
    if (profile) {
      const avatarUrl = profile.avatarUrl && profile.avatarUrl.trim() ? profile.avatarUrl : "";
      setFormData({
        firstName: getProfileField("firstName", "first_name"),
        lastName: getProfileField("lastName", "last_name"),
        bio: getProfileField("bio", "bio"),
        businessName: getProfileField("businessName", "business_name"),
        country: getProfileField("country", "country"),
        avatarUrl: avatarUrl,
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await updateProfile.mutateAsync({
        firstName: formData.firstName,
        lastName: formData.lastName,
        businessName: formData.businessName,
        country: formData.country,
        bio: formData.bio,
        avatarUrl: formData.avatarUrl && formData.avatarUrl.trim() ? formData.avatarUrl.trim() : undefined,
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

  // Handle image deletion - automatically save to database
  const handleImageDelete = async (imageUrl: string) => {
    const deleted = await deleteImage(imageUrl);
    if (deleted) {
      // Update local state
      setFormData({ ...formData, avatarUrl: "" });
      
      // Automatically save the deletion to the database
      try {
        await updateProfile.mutateAsync({
          avatarUrl: undefined, // Set to undefined to clear the field
        });
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
            <Button onClick={() => window.location.reload()}>Retry</Button>
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
              {formData.firstName || getProfileField("firstName", "first_name") || "User"} {formData.lastName || getProfileField("lastName", "last_name") || ""}
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">{formData.businessName || getProfileField("businessName", "business_name") || "No company"}</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{formData.country || getProfileField("country", "country") || "No location"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div className="space-y-2">
              <Label>Profile Picture</Label>
              <ImageUpload
                value={
                  (formData.avatarUrl && formData.avatarUrl.trim()) || 
                  (profile?.avatarUrl && profile.avatarUrl.trim()) || 
                  undefined
                }
                onChange={(url) => setFormData({ ...formData, avatarUrl: url || "" })}
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
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  placeholder="Enter your first name"
                  className="h-11 sm:h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  placeholder="Enter your last name"
                  className="h-11 sm:h-10"
                />
              </div>
            </div>

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
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location/Country</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="location"
                  value={formData.country}
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value })
                  }
                  placeholder="City, Country"
                  className="pl-10 h-11 sm:h-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company/Organization</Label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="company"
                  value={formData.businessName}
                  onChange={(e) =>
                    setFormData({ ...formData, businessName: e.target.value })
                  }
                  placeholder="Your company name"
                  className="pl-10 h-11 sm:h-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) =>
                  setFormData({ ...formData, bio: e.target.value })
                }
                placeholder="Tell us about yourself and your business..."
                className="min-h-[100px] sm:min-h-[120px]"
              />
              <p className="text-xs text-muted-foreground">
                A brief description helps funders understand your background
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 sm:gap-4">
              <Button 
                type="button" 
                variant="outline"
                className="min-h-[44px]"
                onClick={() => {
                  // Reset form to original profile data
                  if (profile) {
                    setFormData({
                      firstName: getProfileField("firstName", "first_name"),
                      lastName: getProfileField("lastName", "last_name"),
                      bio: getProfileField("bio", "bio"),
                      businessName: getProfileField("businessName", "business_name"),
                      country: getProfileField("country", "country"),
                      avatarUrl: getProfileField("avatarUrl", "avatar_url") || "",
                    });
                  }
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
        </CardContent>
      </Card>

      {/* Identity Verification */}
      <KycVerificationSection />

      {/* Profile Completion */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Profile Completion</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium">75% Complete</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: "75%" }}></div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between py-1">
                <span>Basic Information</span>
                <span className="text-success">✓ Complete</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span>Company Details</span>
                <span className="text-success">✓ Complete</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span>Bio & Description</span>
                <span className="text-success">✓ Complete</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span>Documents</span>
                <span className="text-warning">Incomplete</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;

