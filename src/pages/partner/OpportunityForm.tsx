import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  usePartnerOpportunity,
  useCreatePartnerOpportunity,
  useUpdatePartnerOpportunity,
  usePartnerOpportunityTags,
  PartnerOpportunityFormData,
} from "@/hooks/usePartnerOpportunities";
import { useSectors } from "@/hooks/useSectors";
import { useOpportunityTags } from "@/hooks/useOpportunities";
import { useOpportunityFiles } from "@/hooks/useOpportunityFiles";
import { useImageUpload } from "@/hooks/useImageUpload";
import { OpportunityFormContent } from "@/components/opportunity/OpportunityFormContent";
import { getProjectApplicationStateLabel } from "@/lib/projectAvailability";

const opportunityTypeValues = [
  "grant",
  "fellowship",
  "scholarship",
  "internship",
  "training",
  "competition",
  "accelerator",
  "incubator",
  "job",
] as const;

const plainTextLength = (html: string) =>
  html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length;

const partnerSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z
    .string()
    .min(1, "Description is required")
    .refine(
      (val) => plainTextLength(val) >= 50,
      "Description must be at least 50 characters"
    ),
  status: z.enum(["new", "open", "closing-soon", "closed"]),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline must be YYYY-MM-DD"),
  fundingAmount: z.string().optional(),
  location: z.string().min(1, "Location is required"),
  requirements: z.string().optional(),
  eligibilityCriteria: z.string().optional(),
  imageUrl: z.string().optional().or(z.literal("")),
  maxApplicants: z.preprocess(
    (v) => (v === "" || v === null || (typeof v === "number" && isNaN(v)) ? undefined : v),
    z.number().int().positive().optional()
  ),
  currency: z.string().optional(),
  country: z.string().optional(),
  sectorId: z.preprocess(
    (v) => (v === "" || v === null || (typeof v === "number" && isNaN(v)) ? undefined : v),
    z.number().int().optional()
  ),
  opportunityType: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.enum(opportunityTypeValues, { required_error: "Select an opportunity type" })
  ),
});

type PartnerFormValues = z.infer<typeof partnerSchema>;

const PartnerOpportunityForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;
  const opportunityId = id ? parseInt(id) : undefined;

  const { data: opportunity, isLoading } = usePartnerOpportunity(opportunityId);
  const { data: sectors = [] } = useSectors();
  const { data: allTags = [] } = useOpportunityTags();
  const { data: existingTagNames = [] } = usePartnerOpportunityTags(opportunityId);
  const createOpp = useCreatePartnerOpportunity();
  const updateOpp = useUpdatePartnerOpportunity();

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const { documents, isUploading: isFilesUploading, upload, uploadWithId, remove } = useOpportunityFiles(opportunityId);

  const { uploadImage, deleteImage, isUploading: isImageUploading, uploadProgress: imageUploadProgress } = useImageUpload({
    bucket: "project-images",
    folder: "projects",
    maxSizeMB: 5,
  });

  const form = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "open",
      deadline: "",
      fundingAmount: "",
      location: "",
      requirements: "",
      eligibilityCriteria: "",
      currency: "USD",
      country: "",
      opportunityType: undefined,
      sectorId: undefined,
      maxApplicants: undefined,
      imageUrl: "",
    },
  });

  const { setValue } = form;
  const status = form.watch("status");
  const deadline = form.watch("deadline");

  const tagSuggestions =
    tagInput.trim().length > 0
      ? allTags
          .filter(
            (t) => t.name.toLowerCase().includes(tagInput.toLowerCase()) && !selectedTags.includes(t.name)
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
    setSelectedTags((prev) => prev.filter((t) => t !== name));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (tagInput.trim()) addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1]);
    }
  };

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

  useEffect(() => {
    if (opportunity && isEditing) {
      form.reset({
        title: opportunity.title,
        description: opportunity.description,
        status: opportunity.status as PartnerFormValues["status"],
        deadline: opportunity.deadline ? new Date(opportunity.deadline).toISOString().split("T")[0] : "",
        fundingAmount: opportunity.fundingAmount,
        location: opportunity.location,
        requirements: opportunity.requirements || "",
        eligibilityCriteria: opportunity.eligibilityCriteria || "",
        maxApplicants: opportunity.maxApplicants || undefined,
        currency: opportunity.currency || "USD",
        country: opportunity.country || "",
        sectorId: opportunity.sectorId || undefined,
        opportunityType: opportunity.opportunityType as PartnerFormValues["opportunityType"],
        imageUrl: opportunity.imageUrl || "",
      });
    }
  }, [opportunity, isEditing, form]);

  useEffect(() => {
    if (existingTagNames.length > 0) {
      setSelectedTags(existingTagNames);
    }
  }, [existingTagNames]);

  const onSubmit = async (data: PartnerFormValues) => {
    const formData: PartnerOpportunityFormData = {
      title: data.title,
      description: data.description,
      status: data.status,
      deadline: data.deadline,
      fundingAmount: data.fundingAmount,
      location: data.location,
      imageUrl: data.imageUrl || undefined,
      requirements: data.requirements,
      eligibilityCriteria: data.eligibilityCriteria,
      maxApplicants: data.maxApplicants,
      currency: data.currency,
      country: data.country,
      sectorId: data.sectorId,
      opportunityType: data.opportunityType,
      tags: selectedTags,
    };

    try {
      if (isEditing && opportunityId) {
        await updateOpp.mutateAsync({ id: opportunityId, data: formData });
      } else {
        const created = await createOpp.mutateAsync(formData);
        for (const file of pendingFiles) {
          await uploadWithId(created.id, file);
        }
        setPendingFiles([]);
      }
      navigate("/partner/opportunities");
    } catch {
      // useUpdatePartnerOpportunity / useCreatePartnerOpportunity show error toasts
    }
  };

  return (
    <OpportunityFormContent
      variant="partner"
      form={form as any}
      backHref="/partner/opportunities"
      backLabel="Back"
      onBack={() => navigate("/partner/opportunities")}
      isEditing={isEditing}
      isSubmitting={form.formState.isSubmitting || createOpp.isPending || updateOpp.isPending}
      isLoading={isEditing && isLoading}
      title={isEditing ? "Edit Opportunity" : "Create New Opportunity"}
      subtitle={isEditing ? "Update your opportunity details" : "Set up a new funding opportunity"}
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
      isImageUploading={isImageUploading}
      imageUploadProgress={imageUploadProgress}
      showApplicationState
      applicationStateLabel={getProjectApplicationStateLabel(status, deadline)}
      showCurrentApplicants={isEditing}
      currentApplicantsCount={opportunity?.currentApplicants ?? 0}
    />
  );
};

export default PartnerOpportunityForm;
