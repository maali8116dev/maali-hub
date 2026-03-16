import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useProject, useCreateProject, useUpdateProject, ProjectFormData } from "@/hooks/useAdminProjects";
import { useOpportunityTags } from "@/hooks/useOpportunities";
import { syncOpportunityTags, usePartnerOpportunityTags } from "@/hooks/usePartnerOpportunities";
import { useSectors } from "@/hooks/useSectors";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useOpportunityFiles } from "@/hooks/useOpportunityFiles";
import { OpportunityFormContent } from "@/components/opportunity/OpportunityFormContent";
import { getProjectApplicationStateLabel } from "@/lib/projectAvailability";

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((val) => {
    if (val === "" || val === null || (typeof val === "number" && isNaN(val))) {
      return undefined;
    }
    return val;
  }, schema.optional());

const projectSchema = z.object({
  title: z.string().min(1, "Title is required").min(5, "Title must be at least 5 characters"),
  description: z.string().min(1, "Description is required").min(50, "Description must be at least 50 characters"),
  sectorId: z.preprocess(
    (val) => {
      if (val === "" || val === null || (typeof val === "number" && isNaN(val))) {
        return undefined;
      }
      return val;
    },
    z.number().int().optional()
  ),
  opportunityType: z
    .enum(["grant", "fellowship", "scholarship", "internship", "training", "competition", "accelerator", "incubator", "job"])
    .nullable()
    .optional(),
  status: z.enum(["new", "open", "closing-soon", "closed", "archived"]),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline must be in YYYY-MM-DD format"),
  fundingAmount: z.string().optional(),
  currency: z.string().optional(),
  location: z.string().min(1, "Location is required"),
  country: z.string().optional(),
  imageUrl: z.string().optional().or(z.literal("")),
  requirements: z.string().optional(),
  eligibilityCriteria: z.string().optional(),
  maxApplicants: optionalNumber(z.number().int().positive("Max applicants must be a positive number")),
  currentApplicants: optionalNumber(z.number().int().min(0, "Current applicants cannot be negative")),
  featured: z.boolean().optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

const ProjectForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;
  const projectId = id ? parseInt(id) : undefined;

  const { data: project, isLoading: isLoadingProject } = useProject(projectId);
  const { data: sectors = [] } = useSectors();
  const { data: allTags = [] } = useOpportunityTags();
  const { data: existingTagNames = [] } = usePartnerOpportunityTags(projectId);
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const { documents, isUploading: isFilesUploading, upload, uploadWithId, remove } = useOpportunityFiles(projectId);

  const { uploadImage, deleteImage, isUploading, uploadProgress } = useImageUpload({
    bucket: "project-images",
    folder: "projects",
    maxSizeMB: 5,
  });

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: "",
      description: "",
      sectorId: undefined,
      opportunityType: null,
      status: "open",
      deadline: "",
      fundingAmount: "",
      currency: "USD",
      location: "",
      country: "",
      imageUrl: "",
      requirements: "",
      eligibilityCriteria: "",
      maxApplicants: undefined,
      currentApplicants: undefined,
      featured: false,
    },
  });

  const { setValue } = form;
  const status = form.watch("status");
  const deadline = form.watch("deadline");

  const handleImageDelete = async (url: string): Promise<boolean> => {
    if (url && url.includes("storage/v1/object/public/project-images")) {
      const deleted = await deleteImage(url);
      if (deleted) {
        setValue("imageUrl", "");
        return true;
      }
      return false;
    }
    setValue("imageUrl", "");
    return true;
  };

  const tagSuggestions =
    tagInput.trim().length > 0
      ? allTags
          .filter(
            (tag) =>
              tag.name.toLowerCase().includes(tagInput.toLowerCase()) &&
              !selectedTags.includes(tag.name)
          )
          .slice(0, 6)
      : [];

  const addTag = (name: string) => {
    const trimmed = name.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags((prev) => [...prev, trimmed]);
    }
    setTagInput("");
    setShowSuggestions(false);
  };

  const removeTag = (name: string) => {
    setSelectedTags((prev) => prev.filter((tag) => tag !== name));
  };

  const handleTagKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (tagInput.trim()) addTag(tagInput);
    } else if (event.key === "Backspace" && !tagInput && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1]);
    }
  };

  useEffect(() => {
    if (project && isEditing) {
      const deadlineDate = project.deadline ? new Date(project.deadline).toISOString().split("T")[0] : "";
      form.reset({
        title: project.title,
        description: project.description,
        sectorId: project.sectorId || undefined,
        opportunityType: (project.opportunityType as any) || null,
        status: project.status,
        deadline: deadlineDate,
        fundingAmount: project.fundingAmount,
        currency: project.currency || "USD",
        location: project.location,
        country: project.country || "",
        imageUrl: project.imageUrl || "",
        requirements: project.requirements || "",
        eligibilityCriteria: project.eligibilityCriteria || "",
        maxApplicants: project.maxApplicants || undefined,
        currentApplicants: project.currentApplicants || undefined,
        featured: project.featured || false,
      });
    }
  }, [project, isEditing, form]);

  useEffect(() => {
    if (existingTagNames.length > 0) {
      setSelectedTags(existingTagNames);
    }
  }, [existingTagNames]);

  const onSubmit = async (data: ProjectFormValues) => {
    try {
      const isGrant = data.opportunityType === "grant";
      const formData: ProjectFormData = {
        title: data.title,
        description: data.description,
        sectorId: data.sectorId,
        opportunityType: data.opportunityType ?? null,
        status: data.status,
        deadline: data.deadline,
        fundingAmount: isGrant ? data.fundingAmount || null : null,
        currency: isGrant ? data.currency || "USD" : null,
        location: data.location,
        country: data.country || null,
        imageUrl: data.imageUrl || undefined,
        requirements: data.requirements || undefined,
        eligibilityCriteria: data.eligibilityCriteria || undefined,
        maxApplicants: data.maxApplicants || undefined,
        ...(isEditing ? {} : { currentApplicants: data.currentApplicants || undefined }),
        featured: data.featured || false,
      };

      if (isEditing && projectId) {
        await updateProject.mutateAsync({ id: projectId, data: formData });
        if (selectedTags.length) {
          await syncOpportunityTags(projectId, selectedTags);
        }
      } else {
        const created = await createProject.mutateAsync(formData);
        if (selectedTags.length) {
          await syncOpportunityTags(created.id, selectedTags);
        }
        for (const file of pendingFiles) {
          await uploadWithId(created.id, file);
        }
        setPendingFiles([]);
      }

      navigate("/admin/opportunities");
    } catch (error) {
      console.error("Error saving project:", error);
    }
  };

  return (
    <OpportunityFormContent
      variant="admin"
      form={form}
      backHref="/admin/opportunities"
      backLabel="Back to Opportunities"
      onBack={() => navigate("/admin/opportunities")}
      isEditing={isEditing}
      isSubmitting={form.formState.isSubmitting}
      isLoading={isEditing && isLoadingProject}
      title={isEditing ? "Edit Opportunity" : "Create New Opportunity"}
      subtitle={isEditing ? "Update opportunity details" : "Fill in the details to create a new opportunity"}
      sectors={sectors}
      allTags={allTags}
      selectedTags={selectedTags}
      tagInput={tagInput}
      showSuggestions={showSuggestions}
      tagInputRef={tagInputRef}
      tagSuggestions={tagSuggestions}
      setTagInput={setTagInput}
      setShowSuggestions={setShowSuggestions}
      addTag={addTag}
      removeTag={removeTag}
      handleTagKeyDown={handleTagKeyDown}
      onSubmit={onSubmit}
      documents={documents}
      isFilesUploading={isFilesUploading}
      upload={upload}
      remove={remove}
      pendingFiles={pendingFiles}
      setPendingFiles={setPendingFiles}
      uploadWithId={uploadWithId}
      showImageSection
      imageUrl={form.watch("imageUrl")}
      onImageChange={(url) => setValue("imageUrl", url || "")}
      onImageUpload={uploadImage}
      onImageDelete={handleImageDelete}
      isImageUploading={isUploading}
      imageUploadProgress={uploadProgress}
      showApplicationState
      applicationStateLabel={getProjectApplicationStateLabel(status, deadline)}
      showCurrentApplicants={isEditing}
      currentApplicantsCount={form.watch("currentApplicants") ?? 0}
      showFeatured
    />
  );
};

export default ProjectForm;
