import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  useProject,
  useCreateProject,
  useUpdateProject,
  type ProjectFormData,
} from "@/hooks/useAdminProjects";
import {
  usePartnerOpportunity,
  useCreatePartnerOpportunity,
  useUpdatePartnerOpportunity,
  syncOpportunityTags,
  usePartnerOpportunityTags,
  type PartnerOpportunityFormData,
} from "@/hooks/usePartnerOpportunities";
import { useOpportunityTags } from "@/hooks/useOpportunities";
import { useSectors } from "@/hooks/useSectors";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useOpportunityFiles } from "@/hooks/useOpportunityFiles";
import { useToast } from "@/hooks/use-toast";
import { PartnerOrgRequiredAlert } from "@/components/partner/PartnerOrgRequiredAlert";
import { usePartnerOrgLinked } from "@/hooks/usePartnerOrg";
import { OpportunityFormContent } from "@/components/opportunity/OpportunityFormContent";
import { getProjectApplicationStateLabel } from "@/lib/projectAvailability";
import { localizeOpportunityFields } from "@/lib/localizedContent";
import {
  createOpportunitySchema,
  type OpportunityFormRole,
  type OpportunityFormValues,
} from "@/lib/schemas/opportunityForm.schema";

type PartnerOpportunityPrefill = {
  title?: string;
  fundingAmount?: string;
  deadline?: string;
};

export type OpportunityFormProps = {
  role: OpportunityFormRole;
  opportunityId?: number;
};

export function OpportunityForm({ role, opportunityId }: OpportunityFormProps) {
  const { t, i18n } = useTranslation(["dashboard", "common"]);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state as { prefill?: PartnerOpportunityPrefill } | null)?.prefill;
  const isEditing = opportunityId != null;
  const { isLinked, isLoading: isLoadingPartnerOrg } = usePartnerOrgLinked();
  const partnerCreateBlocked = role === "partner" && !isEditing && !isLinked;

  const { data: adminProject, isLoading: isLoadingAdmin } = useProject(
    role === "admin" ? opportunityId : undefined,
  );
  const { data: partnerOpportunity, isLoading: isLoadingPartner } = usePartnerOpportunity(
    role === "partner" ? opportunityId : undefined,
  );
  const opportunity = role === "admin" ? adminProject : partnerOpportunity;
  const isLoading = isEditing && (role === "admin" ? isLoadingAdmin : isLoadingPartner);

  const { data: sectors = [] } = useSectors();
  const { data: allTags = [] } = useOpportunityTags();
  const { data: existingTagNames = [] } = usePartnerOpportunityTags(opportunityId);

  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const createPartnerOpp = useCreatePartnerOpportunity();
  const updatePartnerOpp = useUpdatePartnerOpportunity();

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const { documents, isUploading: isFilesUploading, upload, uploadWithId, remove } =
    useOpportunityFiles(opportunityId);

  const { uploadImage, deleteImage, isUploading, uploadProgress } = useImageUpload({
    bucket: "project-images",
    folder: "projects",
    maxSizeMB: 5,
  });

  const schema = useMemo(() => createOpportunitySchema(t, { role }), [t, role]);

  const form = useForm<OpportunityFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      sectorId: undefined,
      opportunityType: role === "admin" ? null : undefined,
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
      ...(role === "admin" ? { currentApplicants: undefined, featured: false } : {}),
    },
  });

  const { setValue } = form;
  const status = form.watch("status");
  const deadline = form.watch("deadline");

  const listPath = role === "admin" ? "/admin/opportunities" : "/partner/opportunities";

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
              !selectedTags.includes(tag.name),
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
    if (opportunity && isEditing) {
      const localized = localizeOpportunityFields(
        {
          title: opportunity.title,
          description: opportunity.description,
          requirements: opportunity.requirements,
          eligibilityCriteria: opportunity.eligibilityCriteria,
          translations: opportunity.translations ?? null,
        },
        i18n.language,
      );
      const deadlineDate = opportunity.deadline
        ? new Date(opportunity.deadline).toISOString().split("T")[0]
        : "";
      form.reset({
        title: localized.title,
        description: localized.description,
        sectorId: opportunity.sectorId || undefined,
        opportunityType: (opportunity.opportunityType as OpportunityFormValues["opportunityType"]) ?? null,
        status: opportunity.status as OpportunityFormValues["status"],
        deadline: deadlineDate,
        fundingAmount: opportunity.fundingAmount ?? "",
        currency: opportunity.currency || "USD",
        location: opportunity.location,
        country: opportunity.country || "",
        imageUrl: opportunity.imageUrl || "",
        requirements: localized.requirements || "",
        eligibilityCriteria: localized.eligibilityCriteria || "",
        maxApplicants: opportunity.maxApplicants || undefined,
        ...(role === "admin"
          ? {
              currentApplicants: opportunity.currentApplicants || undefined,
              featured: opportunity.featured || false,
            }
          : {}),
      });
    }
  }, [opportunity, isEditing, form, role, i18n.language]);

  useEffect(() => {
    if (existingTagNames.length > 0) {
      setSelectedTags(existingTagNames);
    }
  }, [existingTagNames]);

  useEffect(() => {
    if (role !== "partner" || isEditing || !prefill) return;
    const current = form.getValues();
    form.reset({
      ...current,
      title: prefill.title || current.title,
      fundingAmount: prefill.fundingAmount || current.fundingAmount,
      deadline: prefill.deadline || current.deadline,
    });
    navigate(location.pathname, { replace: true, state: {} });
  }, [role, isEditing, prefill, form, navigate, location.pathname]);

  const onSubmit = async (data: OpportunityFormValues) => {
    try {
      if (role === "admin") {
        const isGrant = data.opportunityType === "grant";
        const adminData = data as OpportunityFormValues & {
          currentApplicants?: number;
          featured?: boolean;
        };
        const formData: ProjectFormData = {
          title: data.title,
          description: data.description,
          sectorId: data.sectorId,
          opportunityType: data.opportunityType ?? null,
          status: data.status as ProjectFormData["status"],
          deadline: data.deadline,
          fundingAmount: isGrant ? data.fundingAmount || null : null,
          currency: isGrant ? data.currency || "USD" : null,
          location: data.location,
          country: data.country || null,
          imageUrl: data.imageUrl || undefined,
          requirements: data.requirements || undefined,
          eligibilityCriteria: data.eligibilityCriteria || undefined,
          maxApplicants: data.maxApplicants || undefined,
          ...(isEditing ? {} : { currentApplicants: adminData.currentApplicants || undefined }),
          featured: adminData.featured || false,
        };

        if (isEditing && opportunityId) {
          await updateProject.mutateAsync({ id: opportunityId, data: formData });
          if (selectedTags.length) {
            await syncOpportunityTags(opportunityId, selectedTags);
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
      } else {
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
          opportunityType: data.opportunityType as string,
          tags: selectedTags,
        };

        if (isEditing && opportunityId) {
          await updatePartnerOpp.mutateAsync({ id: opportunityId, data: formData });
        } else {
          const created = await createPartnerOpp.mutateAsync(formData);
          for (const file of pendingFiles) {
            await uploadWithId(created.id, file);
          }
          setPendingFiles([]);
        }
      }

      navigate(listPath);
    } catch (error) {
      if (role === "admin") {
        console.error("Error saving project:", error);
        return;
      }
      const message = error instanceof Error ? error.message : undefined;
      toast({
        variant: "destructive",
        title: t(
          isEditing ? "common:toasts.opportunity.updateError" : "common:toasts.opportunity.createError",
        ),
        description: message || t("common:toasts.genericError"),
      });
    }
  };

  const isSubmitting =
    form.formState.isSubmitting ||
    (role === "partner" && (createPartnerOpp.isPending || updatePartnerOpp.isPending));

  if (partnerCreateBlocked && !isLoadingPartnerOrg) {
    return (
      <div className="space-y-6">
        <PartnerOrgRequiredAlert />
      </div>
    );
  }

  return (
    <OpportunityFormContent
      role={role}
      form={form}
      backHref={listPath}
      onBack={() => navigate(listPath)}
      isEditing={isEditing}
      isSubmitting={isSubmitting}
      isLoading={isLoading}
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
      applicationStateLabel={getProjectApplicationStateLabel(status, deadline, t)}
      showCurrentApplicants={isEditing}
      currentApplicantsCount={
        role === "admin"
          ? (form.watch("currentApplicants" as keyof OpportunityFormValues) as number | undefined) ?? 0
          : (opportunity?.currentApplicants ?? 0)
      }
      showFeatured={role === "admin"}
    />
  );
}
