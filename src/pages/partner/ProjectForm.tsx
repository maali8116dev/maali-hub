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
import { usePartnerProject, useCreatePartnerProject, useUpdatePartnerProject, PartnerProjectFormData } from "@/hooks/usePartnerProjects";
import { useCategories } from "@/hooks/useCategories";

const projectSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(50, "Description must be at least 50 characters"),
  category: z.string().min(1, "Category is required"),
  status: z.enum(["new", "open", "closing-soon", "closed"]),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline must be YYYY-MM-DD"),
  fundingAmount: z.string().min(1, "Funding amount is required"),
  location: z.string().min(1, "Location is required"),
  requirements: z.string().optional(),
  eligibilityCriteria: z.string().optional(),
  applicationFee: z.preprocess((v) => (v === "" || v === null || (typeof v === "number" && isNaN(v)) ? undefined : v), z.number().min(0).optional()),
  maxApplicants: z.preprocess((v) => (v === "" || v === null || (typeof v === "number" && isNaN(v)) ? undefined : v), z.number().int().positive().optional()),
});

type FormValues = z.infer<typeof projectSchema>;

const PartnerProjectForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;
  const projectId = id ? parseInt(id) : undefined;

  const { data: project, isLoading } = usePartnerProject(projectId);
  const { data: categories = [] } = useCategories();
  const createProject = useCreatePartnerProject();
  const updateProject = useUpdatePartnerProject();

  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch, reset } = useForm<FormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { title: "", description: "", category: "", status: "open", deadline: "", fundingAmount: "", location: "", requirements: "", eligibilityCriteria: "" },
  });

  const status = watch("status");
  const category = watch("category");

  useEffect(() => {
    if (project && isEditing) {
      reset({
        title: project.title,
        description: project.description,
        category: project.category || "",
        status: project.status as any,
        deadline: project.deadline ? new Date(project.deadline).toISOString().split("T")[0] : "",
        fundingAmount: project.fundingAmount,
        location: project.location,
        requirements: project.requirements || "",
        eligibilityCriteria: project.eligibilityCriteria || "",
        applicationFee: project.applicationFee ? parseFloat(project.applicationFee.toString()) : undefined,
        maxApplicants: project.maxApplicants || undefined,
      });
    }
  }, [project, isEditing, reset]);

  const onSubmit = async (data: FormValues) => {
    const formData: PartnerProjectFormData = {
      title: data.title,
      description: data.description,
      category: data.category,
      status: data.status,
      deadline: data.deadline,
      fundingAmount: data.fundingAmount,
      location: data.location,
      requirements: data.requirements,
      eligibilityCriteria: data.eligibilityCriteria,
      applicationFee: data.applicationFee,
      maxApplicants: data.maxApplicants,
    };

    if (isEditing && projectId) {
      await updateProject.mutateAsync({ id: projectId, data: formData });
    } else {
      await createProject.mutateAsync(formData);
    }
    navigate("/partner/projects");
  };

  if (isEditing && isLoading) {
    return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Loading project...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isEditing ? "Edit Project" : "Create New Project"}</h1>
          <p className="text-muted-foreground">{isEditing ? "Update your project details" : "Set up a new funding opportunity"}</p>
        </div>
        <Button variant="ghost" onClick={() => navigate("/partner/projects")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input id="title" {...register("title")} className={errors.title ? "border-destructive" : ""} />
              {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
            </div>
            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea id="description" {...register("description")} rows={6} className={errors.description ? "border-destructive" : ""} />
              {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Category *</Label>
                <Select value={category} onValueChange={(v) => setValue("category", v, { shouldValidate: true })}>
                  <SelectTrigger className={errors.category ? "border-destructive" : ""}><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-sm text-destructive mt-1">{errors.category.message}</p>}
              </div>
              <div>
                <Label>Status *</Label>
                <Select value={status} onValueChange={(v) => setValue("status", v as any, { shouldValidate: true })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closing-soon">Closing Soon</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="deadline">Deadline *</Label>
                <Input id="deadline" type="date" {...register("deadline")} className={errors.deadline ? "border-destructive" : ""} />
                {errors.deadline && <p className="text-sm text-destructive mt-1">{errors.deadline.message}</p>}
              </div>
              <div>
                <Label htmlFor="location">Location *</Label>
                <Input id="location" {...register("location")} className={errors.location ? "border-destructive" : ""} />
                {errors.location && <p className="text-sm text-destructive mt-1">{errors.location.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fundingAmount">Funding Amount *</Label>
                <Input id="fundingAmount" {...register("fundingAmount")} className={errors.fundingAmount ? "border-destructive" : ""} />
                {errors.fundingAmount && <p className="text-sm text-destructive mt-1">{errors.fundingAmount.message}</p>}
              </div>
              <div>
                <Label htmlFor="applicationFee">Application Fee</Label>
                <Input id="applicationFee" type="number" step="0.01" min="0" {...register("applicationFee", { valueAsNumber: true })} />
                <p className="text-xs text-muted-foreground mt-1">Leave empty for free</p>
              </div>
            </div>
            <div>
              <Label htmlFor="requirements">Requirements</Label>
              <Textarea id="requirements" {...register("requirements")} rows={3} />
            </div>
            <div>
              <Label htmlFor="eligibilityCriteria">Eligibility Criteria</Label>
              <Textarea id="eligibilityCriteria" {...register("eligibilityCriteria")} rows={3} />
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            <Save className="h-4 w-4 mr-2" />
            {isEditing ? "Update Project" : "Create Project"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PartnerProjectForm;
