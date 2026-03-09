import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Plus, X, Tag } from "lucide-react";
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
import { useCategories } from "@/hooks/useCategories";
import { useOpportunityTags } from "@/hooks/useOpportunities";
import { cn } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(50, "Description must be at least 50 characters"),
  status: z.enum(["new", "open", "closing-soon", "closed"]),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline must be YYYY-MM-DD"),
  fundingAmount: z.string().min(1, "Funding amount is required"),
  location: z.string().min(1, "Location is required"),
  requirements: z.string().optional(),
  eligibilityCriteria: z.string().optional(),
  maxApplicants: z.preprocess(
    (v) => (v === "" || v === null || (typeof v === "number" && isNaN(v)) ? undefined : v),
    z.number().int().positive().optional()
  ),
  currency: z.string().optional(),
  country: z.string().optional(),
  organizationName: z.string().optional(),
  categoryId: z.preprocess(
    (v) => (v === "" || v === null || (typeof v === "number" && isNaN(v)) ? undefined : v),
    z.number().int().optional()
  ),
  opportunityType: z
    .enum(["grant", "fellowship", "scholarship", "internship", "training", "competition", "accelerator", "incubator", "job"])
    .default("grant"),
});

type FormValues = z.infer<typeof schema>;

const PartnerOpportunityForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;
  const opportunityId = id ? parseInt(id) : undefined;

  const { data: opportunity, isLoading } = usePartnerOpportunity(opportunityId);
  const { data: categories = [] } = useCategories();
  const { data: allTags = [] } = useOpportunityTags();
  const { data: existingTagNames = [] } = usePartnerOpportunityTags(opportunityId);
  const createOpp = useCreatePartnerOpportunity();
  const updateOpp = useUpdatePartnerOpportunity();

  // Tag state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "", description: "", status: "open", deadline: "", fundingAmount: "",
      location: "", requirements: "", eligibilityCriteria: "", currency: "USD",
      country: "", organizationName: "", opportunityType: "grant",
    },
  });

  const status = watch("status");
  const categoryId = watch("categoryId");
  const opportunityType = watch("opportunityType");

  // Populate form when editing
  useEffect(() => {
    if (opportunity && isEditing) {
      reset({
        title: opportunity.title,
        description: opportunity.description,
        status: opportunity.status as any,
        deadline: opportunity.deadline ? new Date(opportunity.deadline).toISOString().split("T")[0] : "",
        fundingAmount: opportunity.fundingAmount,
        location: opportunity.location,
        requirements: opportunity.requirements || "",
        eligibilityCriteria: opportunity.eligibilityCriteria || "",
        maxApplicants: opportunity.maxApplicants || undefined,
        currency: opportunity.currency || "USD",
        country: opportunity.country || "",
        organizationName: opportunity.organizationName || "",
        categoryId: opportunity.categoryId || undefined,
        opportunityType: (opportunity.opportunityType as any) || "grant",
      });
    }
  }, [opportunity, isEditing, reset]);

  // Populate tags when editing
  useEffect(() => {
    if (existingTagNames.length > 0) {
      setSelectedTags(existingTagNames);
    }
  }, [existingTagNames]);

  // Tag input suggestions (filter existing tags, exclude already selected)
  const tagSuggestions = tagInput.trim().length > 0
    ? allTags
        .filter((t) => t.name.toLowerCase().includes(tagInput.toLowerCase()) && !selectedTags.includes(t.name))
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

  const onSubmit = async (data: FormValues) => {
    const formData: PartnerOpportunityFormData = {
      title: data.title,
      description: data.description,
      status: data.status,
      deadline: data.deadline,
      fundingAmount: data.fundingAmount,
      location: data.location,
      requirements: data.requirements,
      eligibilityCriteria: data.eligibilityCriteria,
      maxApplicants: data.maxApplicants,
      currency: data.currency,
      country: data.country,
      organizationName: data.organizationName,
      categoryId: data.categoryId,
      opportunityType: data.opportunityType,
      tags: selectedTags,
    };

    if (isEditing && opportunityId) {
      await updateOpp.mutateAsync({ id: opportunityId, data: formData });
    } else {
      await createOpp.mutateAsync(formData);
    }
    navigate("/partner/opportunities");
  };

  if (isEditing && isLoading) {
    return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Loading opportunity...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isEditing ? "Edit Opportunity" : "Create New Opportunity"}</h1>
          <p className="text-muted-foreground">{isEditing ? "Update your opportunity details" : "Set up a new funding opportunity"}</p>
        </div>
        <Button variant="ghost" onClick={() => navigate("/partner/opportunities")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Opportunity Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input id="title" {...register("title")} className={errors.title ? "border-destructive" : ""} />
              {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
            </div>
            <div>
              <Label htmlFor="description">Description *</Label>
              <RichTextEditor
                value={watch("description")}
                onChange={(value) => setValue("description", value, { shouldValidate: true })}
                placeholder="Provide a comprehensive description of your opportunity. Use formatting to make it clear and engaging..."
                error={!!errors.description}
              />
              {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Opportunity Type *</Label>
                <Select value={opportunityType} onValueChange={(v) => setValue("opportunityType", v as any, { shouldValidate: true })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grant">Grant</SelectItem>
                    <SelectItem value="fellowship">Fellowship</SelectItem>
                    <SelectItem value="scholarship">Scholarship</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="competition">Competition</SelectItem>
                    <SelectItem value="accelerator">Accelerator</SelectItem>
                    <SelectItem value="incubator">Incubator</SelectItem>
                    <SelectItem value="job">Job</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select value={categoryId?.toString() || ""} onValueChange={(v) => setValue("categoryId", parseInt(v), { shouldValidate: true })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" {...register("currency")} placeholder="USD" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="country">Country</Label>
                <Input id="country" {...register("country")} placeholder="e.g., Kenya" />
              </div>
              <div>
                <Label htmlFor="organizationName">Organization Name</Label>
                <Input id="organizationName" {...register("organizationName")} />
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

            {/* Tags */}
            <div>
              <Label className="flex items-center gap-1.5 mb-2">
                <Tag className="h-3.5 w-3.5" />
                Tags
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Select existing tags or type a new one and press Enter to create it.
              </p>

              {/* Selected tags */}
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5 transition-colors"
                        aria-label={`Remove ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Input with dropdown */}
              <div className="relative">
                <div className="flex gap-2">
                  <Input
                    ref={tagInputRef}
                    value={tagInput}
                    onChange={(e) => { setTagInput(e.target.value); setShowSuggestions(true); }}
                    onKeyDown={handleTagKeyDown}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder="Type a tag name..."
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { if (tagInput.trim()) addTag(tagInput); }}
                    disabled={!tagInput.trim()}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>

                {/* Suggestions dropdown */}
                {showSuggestions && (tagSuggestions.length > 0 || (tagInput.trim() && !allTags.some((t) => t.name.toLowerCase() === tagInput.toLowerCase()))) && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md overflow-hidden">
                    {tagSuggestions.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onMouseDown={() => addTag(tag.name)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        {tag.name}
                      </button>
                    ))}
                    {tagInput.trim() && !allTags.some((t) => t.name.toLowerCase() === tagInput.toLowerCase()) && (
                      <button
                        type="button"
                        onMouseDown={() => addTag(tagInput)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors border-t border-border flex items-center gap-2"
                      >
                        <Plus className="h-3.5 w-3.5 text-primary" />
                        <span>Create "<strong>{tagInput.trim()}</strong>"</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            <Save className="h-4 w-4 mr-2" />
            {isEditing ? "Update Opportunity" : "Create Opportunity"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PartnerOpportunityForm;
