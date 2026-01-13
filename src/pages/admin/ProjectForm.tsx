import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useProject, useCreateProject, useUpdateProject, ProjectFormData } from "@/hooks/useAdminProjects";
import { useProjectCategories } from "@/hooks/useProjects";

const projectSchema = z.object({
  title: z.string().min(1, "Title is required").min(5, "Title must be at least 5 characters"),
  description: z.string().min(1, "Description is required").min(50, "Description must be at least 50 characters"),
  category: z.string().min(1, "Category is required"),
  status: z.enum(["new", "open", "closing-soon", "closed"]),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline must be in YYYY-MM-DD format"),
  fundingAmount: z.string().min(1, "Funding amount is required"),
  location: z.string().min(1, "Location is required"),
  imageUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  requirements: z.string().optional(),
  eligibilityCriteria: z.string().optional(),
  applicationFee: z.number().min(0, "Application fee must be 0 or greater").optional(),
  maxApplicants: z.number().int().positive("Max applicants must be a positive number").optional(),
  currentApplicants: z.number().int().min(0, "Current applicants cannot be negative").optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

const ProjectForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;
  const projectId = id ? parseInt(id) : undefined;

  const { data: project, isLoading: isLoadingProject } = useProject(projectId);
  const { data: categories = [] } = useProjectCategories();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      status: "open",
      deadline: "",
      fundingAmount: "",
      location: "",
      imageUrl: "",
      requirements: "",
      eligibilityCriteria: "",
      applicationFee: undefined,
      maxApplicants: undefined,
      currentApplicants: undefined,
    },
  });

  const status = watch("status");
  const imageUrl = watch("imageUrl");

  // Load project data when editing
  useEffect(() => {
    if (project && isEditing) {
      // Format deadline for date input (YYYY-MM-DD)
      const deadlineDate = project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : "";
      
      reset({
        title: project.title,
        description: project.description,
        category: project.category,
        status: project.status,
        deadline: deadlineDate,
        fundingAmount: project.fundingAmount,
        location: project.location,
        imageUrl: project.imageUrl || "",
        requirements: project.requirements || "",
        eligibilityCriteria: project.eligibilityCriteria || "",
        applicationFee: project.applicationFee ? parseFloat(project.applicationFee.toString()) : undefined,
        maxApplicants: project.maxApplicants || undefined,
        currentApplicants: project.currentApplicants || undefined,
      });
    }
  }, [project, isEditing, reset]);

  const onSubmit = async (data: ProjectFormValues) => {
    try {
      const formData: ProjectFormData = {
        title: data.title,
        description: data.description,
        category: data.category,
        status: data.status,
        deadline: data.deadline,
        fundingAmount: data.fundingAmount,
        location: data.location,
        imageUrl: data.imageUrl || undefined,
        requirements: data.requirements || undefined,
        eligibilityCriteria: data.eligibilityCriteria || undefined,
        applicationFee: data.applicationFee || undefined,
        maxApplicants: data.maxApplicants || undefined,
        currentApplicants: data.currentApplicants || undefined,
      };

      if (isEditing && projectId) {
        await updateProject.mutateAsync({ id: projectId, data: formData });
      } else {
        await createProject.mutateAsync(formData);
      }

      navigate("/admin/projects");
    } catch (error) {
      // Error handling is done in the mutation hooks
      console.error("Error saving project:", error);
    }
  };

  if (isEditing && isLoadingProject) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {isEditing ? "Edit Project" : "Create New Project"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isEditing ? "Update project details" : "Fill in the details to create a new funding opportunity"}
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate("/admin/projects")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Information</CardTitle>
                <CardDescription>Enter the basic information for the funding opportunity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    {...register("title")}
                    placeholder="e.g., African Women Tech Entrepreneurs Grant"
                    className={errors.title ? "border-destructive" : ""}
                  />
                  {errors.title && (
                    <p className="text-sm text-destructive mt-1">{errors.title.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    {...register("description")}
                    placeholder="Provide a detailed description of the funding opportunity..."
                    rows={8}
                    className={errors.description ? "border-destructive" : ""}
                  />
                  {errors.description && (
                    <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <Select
                      value={watch("category")}
                      onValueChange={(value) => setValue("category", value)}
                    >
                      <SelectTrigger id="category" className={errors.category ? "border-destructive" : ""}>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.category && (
                      <p className="text-sm text-destructive mt-1">{errors.category.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="status">Status *</Label>
                    <Select
                      value={status}
                      onValueChange={(value) => setValue("status", value as "new" | "open" | "closing-soon" | "closed")}
                    >
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closing-soon">Closing Soon</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="deadline">Deadline *</Label>
                    <Input
                      id="deadline"
                      type="date"
                      {...register("deadline")}
                      className={errors.deadline ? "border-destructive" : ""}
                    />
                    {errors.deadline && (
                      <p className="text-sm text-destructive mt-1">{errors.deadline.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="location">Location *</Label>
                    <Input
                      id="location"
                      {...register("location")}
                      placeholder="e.g., Kenya, Nigeria, All Africa"
                      className={errors.location ? "border-destructive" : ""}
                    />
                    {errors.location && (
                      <p className="text-sm text-destructive mt-1">{errors.location.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="fundingAmount">Funding Amount *</Label>
                  <Input
                    id="fundingAmount"
                    {...register("fundingAmount")}
                    placeholder="e.g., Up to $50,000"
                    className={errors.fundingAmount ? "border-destructive" : ""}
                  />
                  {errors.fundingAmount && (
                    <p className="text-sm text-destructive mt-1">{errors.fundingAmount.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Additional Details</CardTitle>
                <CardDescription>Optional information about requirements and eligibility</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="requirements">Requirements</Label>
                  <Textarea
                    id="requirements"
                    {...register("requirements")}
                    placeholder="List any specific requirements for applicants..."
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="eligibilityCriteria">Eligibility Criteria</Label>
                  <Textarea
                    id="eligibilityCriteria"
                    {...register("eligibilityCriteria")}
                    placeholder="Describe who is eligible to apply..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Image */}
            <Card>
              <CardHeader>
                <CardTitle>Project Image</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="imageUrl">Image URL</Label>
                  <Input
                    id="imageUrl"
                    {...register("imageUrl")}
                    placeholder="https://example.com/image.jpg"
                    className={errors.imageUrl ? "border-destructive" : ""}
                  />
                  {errors.imageUrl && (
                    <p className="text-sm text-destructive mt-1">{errors.imageUrl.message}</p>
                  )}
                  {imageUrl && (
                    <div className="relative w-full h-32 rounded-lg overflow-hidden border mt-2">
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
              </CardContent>
            </Card>

            {/* Application Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Application Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="applicationFee">Application Fee</Label>
                  <Input
                    id="applicationFee"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register("applicationFee", { valueAsNumber: true })}
                    placeholder="0.00"
                    className={errors.applicationFee ? "border-destructive" : ""}
                  />
                  {errors.applicationFee && (
                    <p className="text-sm text-destructive mt-1">{errors.applicationFee.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty for free applications
                  </p>
                </div>

                <div>
                  <Label htmlFor="maxApplicants">Max Applicants</Label>
                  <Input
                    id="maxApplicants"
                    type="number"
                    min="1"
                    {...register("maxApplicants", { valueAsNumber: true })}
                    placeholder="Unlimited"
                    className={errors.maxApplicants ? "border-destructive" : ""}
                  />
                  {errors.maxApplicants && (
                    <p className="text-sm text-destructive mt-1">{errors.maxApplicants.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty for unlimited applicants
                  </p>
                </div>

                {isEditing && (
                  <div>
                    <Label htmlFor="currentApplicants">Current Applicants</Label>
                    <Input
                      id="currentApplicants"
                      type="number"
                      min="0"
                      {...register("currentApplicants", { valueAsNumber: true })}
                      className={errors.currentApplicants ? "border-destructive" : ""}
                    />
                    {errors.currentApplicants && (
                      <p className="text-sm text-destructive mt-1">{errors.currentApplicants.message}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSubmitting ? "Saving..." : isEditing ? "Update Project" : "Create Project"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate("/admin/projects")}
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

export default ProjectForm;

