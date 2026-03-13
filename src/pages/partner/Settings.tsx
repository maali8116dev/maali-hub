import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUpload } from "@/components/ui/image-upload";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerOrg, useUpdatePartnerOrg } from "@/hooks/usePartnerOrg";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useToast } from "@/hooks/use-toast";

const PartnerSettings = () => {
  const { user } = useAuth();
  const { data: partnerOrg, isLoading } = usePartnerOrg();
  const updatePartner = useUpdatePartnerOrg();
  const { toast } = useToast();
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [sector, setSector] = useState<string>("Funding");

  const { uploadImage, deleteImage, isUploading, uploadProgress } = useImageUpload({
    bucket: "partner-logos",
    folder: `partner-logos/${user?.id || ""}`,
    maxSizeMB: 5,
  });

  useEffect(() => {
    if (partnerOrg) {
      setName(partnerOrg.name || "");
      setDescription(partnerOrg.description || "");
      setWebsiteUrl(partnerOrg.website_url || "");
      setLogoUrl(partnerOrg.logo_url || "");
      setSector(partnerOrg.sector || "Funding");
    }
  }, [partnerOrg]);

  const handleSave = async () => {
    try {
      await updatePartner.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        website_url: websiteUrl.trim() || null,
        logo_url: logoUrl || null,
        sector,
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

      <Card>
        <CardHeader>
          <CardTitle>Organization Profile</CardTitle>
          <CardDescription>Update your organization information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading organization details...</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Organization Logo</Label>
                <ImageUpload
                  value={logoUrl}
                  onUpload={uploadImage}
                  onRemove={async () => {
                    if (logoUrl) {
                      await deleteImage(logoUrl);
                    }
                    setLogoUrl("");
                  }}
                  isUploading={isUploading}
                  uploadProgress={uploadProgress}
                  placeholder="Upload Logo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="partner-name">Organization Name</Label>
                <Input
                  id="partner-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Organization name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="partner-description">Description</Label>
                <Textarea
                  id="partner-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of your organization"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="partner-website">Website</Label>
                <Input
                  id="partner-website"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://your-website.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Sector</Label>
                <Select value={sector} onValueChange={setSector}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sector" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Funding">Funding</SelectItem>
                    <SelectItem value="Support">Support</SelectItem>
                    <SelectItem value="Impact">Impact</SelectItem>
                    <SelectItem value="Regional">Regional</SelectItem>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Strategic">Strategic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={updatePartner.isPending || !name.trim()}
                >
                  {updatePartner.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerSettings;








