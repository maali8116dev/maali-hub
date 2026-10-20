import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageUpload } from "@/components/ui/image-upload";
import { useMentor, useCreateMentor, useUpdateMentor, useAdminMentors } from "@/hooks/useMentors";
import { useImageUpload } from "@/hooks/useImageUpload";
import { ArrowLeft, X, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { COUNTRIES } from "@/components/application/form/countries";

type MentorFormValues = {
  name: string;
  bio?: string;
  sector?: string;
  country?: string;
  linkedin_url?: string;
  twitter_url?: string;
  website_url?: string;
  avatar_url?: string;
  display_order: number;
  is_published: boolean;
};

const PREDEFINED_sectorS = [
  "Agriculture",
  "Technology",
  "Financial Services",
  "Healthcare",
  "Education",
  "Energy",
  "Logistics",
  "Manufacturing",
  "Marketing",
  "Retail",
  "Real Estate",
];

const AdminMentorForm = () => {
  const { t, i18n } = useTranslation(["dashboard"]);
  const ff = "admin.cmsForm.mentor";
  const fc = "admin.cmsForm.common";
  const fv = "admin.cmsForm.validation";

  const mentorSchema = useMemo(
    () =>
      z.object({
        name: z.string().min(2, t(`${fv}.nameMin2`)),
        bio: z.string().optional(),
        sector: z.string().optional(),
        country: z.string().optional(),
        linkedin_url: z.string().url(t(`${fv}.validUrl`)).optional().or(z.literal("")),
        twitter_url: z.string().url(t(`${fv}.validUrl`)).optional().or(z.literal("")),
        website_url: z.string().url(t(`${fv}.validUrl`)).optional().or(z.literal("")),
        avatar_url: z.string().url(t(`${fv}.validUrl`)).optional().or(z.literal("")),
        display_order: z.number().min(0),
        is_published: z.boolean(),
      }),
    [t, i18n.language]
  );

  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const { data: mentor, isLoading: mentorLoading } = useMentor(id ? parseInt(id) : undefined);
  const { data: allMentors } = useAdminMentors();
  const createMentor = useCreateMentor();
  const updateMentor = useUpdateMentor();

  const [expertiseInput, setExpertiseInput] = useState("");
  const [expertiseAreas, setExpertiseAreas] = useState<string[]>([]);
  
  const { uploadImage, deleteImage, isUploading, uploadProgress } = useImageUpload({
    bucket: "mentor-avatars",
    maxSizeMB: 5,
  });

  const form = useForm<MentorFormValues>({
    resolver: zodResolver(mentorSchema),
    defaultValues: {
      name: "",
      bio: "",
      sector: "",
      country: "",
      linkedin_url: "",
      twitter_url: "",
      website_url: "",
      avatar_url: "",
      display_order: 0,
      is_published: true,
    },
  });

  // Get existing sectors from database
  const existingsectors = [...new Set(allMentors?.map(m => m.sector).filter(Boolean))] as string[];
  const allsectors = [...new Set([...PREDEFINED_sectorS, ...existingsectors])].sort();

  // Get existing countries from database
  const existingCountries = [...new Set(allMentors?.map(m => m.country).filter(Boolean))] as string[];
  const countryOptions = useMemo(() => {
    const byValue = new Map<string, { value: string; label: string }>(
      COUNTRIES.map((c) => [c.value, { value: c.value, label: c.label }])
    );
    for (const country of existingCountries) {
      if (!byValue.has(country)) byValue.set(country, { value: country, label: country });
    }
    return [...byValue.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [existingCountries]);

  // Load mentor data when editing
  useEffect(() => {
    if (mentor) {
      form.reset({
        name: mentor.name,
        bio: mentor.bio || "",
        sector: mentor.sector || "",
        country: mentor.country || "",
        linkedin_url: mentor.linkedin_url || "",
        twitter_url: mentor.twitter_url || "",
        website_url: mentor.website_url || "",
        avatar_url: mentor.avatar_url || "",
        display_order: mentor.display_order,
        is_published: mentor.is_published,
      });
      setExpertiseAreas(mentor.expertise_areas || []);
    }
  }, [mentor, form]);

  const addExpertise = () => {
    if (expertiseInput.trim() && !expertiseAreas.includes(expertiseInput.trim())) {
      setExpertiseAreas([...expertiseAreas, expertiseInput.trim()]);
      setExpertiseInput("");
    }
  };

  const removeExpertise = (expertise: string) => {
    setExpertiseAreas(expertiseAreas.filter(e => e !== expertise));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addExpertise();
    }
  };

  const onSubmit = async (values: MentorFormValues) => {
    const mentorData = {
      ...values,
      expertise_areas: expertiseAreas,
      linkedin_url: values.linkedin_url || null,
      twitter_url: values.twitter_url || null,
      website_url: values.website_url || null,
      avatar_url: values.avatar_url || null,
      sector: values.sector || null,
      country: values.country || null,
      bio: values.bio || null,
    };

    if (isEditing && id) {
      await updateMentor.mutateAsync({ id: parseInt(id), ...mentorData });
    } else {
      await createMentor.mutateAsync(mentorData);
    }
    navigate("/admin/mentors");
  };

  if (isEditing && mentorLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/mentors")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? t(`${ff}.editTitle`) : t(`${ff}.createTitle`)}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? "Update mentor information" : "Add a new mentor to the directory"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Dr. Jane Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Brief description of the mentor's background and expertise..."
                          className="min-h-[120px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sector"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>sector</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a sector" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {allsectors.map(sector => (
                            <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {countryOptions.map(country => (
                            <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Expertise Areas */}
                <div className="space-y-2">
                  <FormLabel>Expertise Areas</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add expertise (e.g., Fundraising)"
                      value={expertiseInput}
                      onChange={(e) => setExpertiseInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <Button type="button" variant="outline" onClick={addExpertise}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {expertiseAreas.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {expertiseAreas.map((expertise, index) => (
                        <Badge key={index} variant="secondary" className="gap-1">
                          {expertise}
                          <button
                            type="button"
                            onClick={() => removeExpertise(expertise)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Links and Settings */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>External Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="linkedin_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LinkedIn URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://linkedin.com/in/..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="twitter_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Twitter URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://twitter.com/..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="website_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="avatar_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Avatar Image</FormLabel>
                        <FormControl>
                          <ImageUpload
                            value={field.value}
                            onChange={(url) => field.onChange(url || "")}
                            onUpload={uploadImage}
                            onDelete={deleteImage}
                            isUploading={isUploading}
                            uploadProgress={uploadProgress}
                            placeholder="Upload Avatar"
                          />
                        </FormControl>
                        <FormDescription>Upload a profile image or paste URL below</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="avatar_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Or paste URL directly</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="display_order"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Order</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            {...field} 
                            onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>Lower numbers appear first</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="is_published"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Published</FormLabel>
                          <FormDescription>
                            Make this mentor visible in the public directory
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={createMentor.isPending || updateMentor.isPending}>
              {createMentor.isPending || updateMentor.isPending
                ? "Saving..."
                : isEditing
                  ? "Update Mentor"
                  : "Create Mentor"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/admin/mentors")}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default AdminMentorForm;








