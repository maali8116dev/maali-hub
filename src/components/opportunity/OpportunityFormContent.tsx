import { RefObject } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Save, Star, Tag, X } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { ImageUpload } from "@/components/ui/image-upload";
import { OpportunityAttachmentsCard } from "@/components/opportunity/OpportunityAttachmentsCard";

/** Minimal form shape shared by admin and partner opportunity forms */
export type OpportunityFormShape = {
  title: string;
  description: string;
  sectorId?: number;
  opportunityType?: string | null;
  status: string;
  deadline: string;
  fundingAmount?: string;
  currency?: string;
  location: string;
  country?: string;
  requirements?: string;
  eligibilityCriteria?: string;
  maxApplicants?: number;
  imageUrl?: string;
  featured?: boolean;
  currentApplicants?: number;
};

export type Sector = { id: number; name: string };
export type TagOption = { id: number; name: string };

export type OpportunityFormContentProps<T extends OpportunityFormShape> = {
  variant: "admin" | "partner";
  form: UseFormReturn<T>;
  backHref: string;
  backLabel: string;
  onBack: () => void;
  isEditing: boolean;
  isSubmitting: boolean;
  isLoading?: boolean;
  title: string;
  subtitle: string;
  sectors: Sector[];
  allTags: TagOption[];
  selectedTags: string[];
  tagInput: string;
  showSuggestions: boolean;
  tagInputRef: RefObject<HTMLInputElement | null>;
  tagSuggestions: TagOption[];
  setTagInput: (v: string) => void;
  setShowSuggestions: (v: boolean) => void;
  addTag: (name: string) => void;
  removeTag: (name: string) => void;
  handleTagKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSubmit: (data: T) => void | Promise<void>;
  /** Attachments card */
  documents: { id: string; name: string; url: string }[];
  isFilesUploading: boolean;
  upload: (file: File) => Promise<void>;
  remove: (id: string) => Promise<void>;
  pendingFiles: File[];
  setPendingFiles: (files: File[] | ((prev: File[]) => File[])) => void;
  uploadWithId?: (opportunityId: number, file: File) => Promise<void>;
  /** Admin-only: image */
  showImageSection?: boolean;
  imageUrl?: string;
  onImageChange?: (url: string) => void;
  onImageUpload?: (file: File) => Promise<string>;
  onImageDelete?: (url: string) => Promise<boolean>;
  isImageUploading?: boolean;
  imageUploadProgress?: number;
  /** Admin-only: application state & current applicants */
  showApplicationState?: boolean;
  applicationStateLabel?: string;
  showCurrentApplicants?: boolean;
  currentApplicantsCount?: number;
  /** Admin-only: featured */
  showFeatured?: boolean;
};

export function OpportunityFormContent<T extends OpportunityFormShape>(
  props: OpportunityFormContentProps<T>
) {
  const {
    variant,
    form,
    backHref,
    backLabel,
    onBack,
    isEditing,
    isSubmitting,
    isLoading = false,
    title,
    subtitle,
    sectors,
    allTags,
    selectedTags,
    tagInput,
    showSuggestions,
    tagInputRef,
    tagSuggestions,
    setTagInput,
    setShowSuggestions,
    addTag,
    removeTag,
    handleTagKeyDown,
    onSubmit,
    documents,
    isFilesUploading,
    upload,
    remove,
    pendingFiles,
    setPendingFiles,
    showImageSection = false,
    imageUrl,
    onImageChange,
    onImageUpload,
    onImageDelete,
    isImageUploading = false,
    imageUploadProgress = 0,
    showApplicationState = false,
    applicationStateLabel,
    showCurrentApplicants = false,
    currentApplicantsCount = 0,
    showFeatured = false,
  } = props;

  const { register, watch, setValue, formState, handleSubmit } = form as UseFormReturn<any>;
  const errors = formState?.errors ?? {};
  const status = watch("status");
  const sectorId = watch("sectorId");
  const opportunityType = watch("opportunityType");
  const deadline = watch("deadline");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">Loading opportunity...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">{subtitle}</p>
        </div>
        <Button variant="ghost" onClick={onBack} className="w-full sm:w-auto min-h-[44px]">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {backLabel}
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Opportunity Information</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Enter the basic information for the opportunity.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    {...register("title")}
                    placeholder="e.g., African Women Tech Entrepreneurs Grant"
                    className={errors.title ? "border-destructive" : ""}
                  />
                  {errors.title && <p className="text-sm text-destructive mt-1">{(errors as any).title.message}</p>}
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <RichTextEditor
                    value={watch("description")}
                    onChange={(value) => setValue("description", value as any, { shouldValidate: true })}
                    placeholder="Provide a comprehensive description of the opportunity. Use formatting to make it clear and engaging..."
                    error={!!errors.description}
                  />
                  {errors.description && <p className="text-sm text-destructive mt-1">{(errors as any).description.message}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Opportunity Type *</Label>
                    <Select
                      value={opportunityType || ""}
                      onValueChange={(value) => setValue("opportunityType", value as any, { shouldValidate: true })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
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
                    <Label>Sector</Label>
                    <Select
                      value={sectorId?.toString() ?? ""}
                      onValueChange={(value) => setValue("sectorId", value ? parseInt(value, 10) : undefined, { shouldValidate: true })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select sector" />
                      </SelectTrigger>
                      <SelectContent>
                        {sectors.map((sector) => (
                          <SelectItem key={sector.id} value={sector.id.toString()}>
                            {sector.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="status">Status *</Label>
                    <Select
                      value={status || "open"}
                      onValueChange={(value) => setValue("status", value, { shouldValidate: true })}
                    >
                      <SelectTrigger id="status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closing-soon">Closing Soon</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        {variant === "admin" && <SelectItem value="archived">Archived</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {opportunityType === "grant" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fundingAmount">Funding Amount *</Label>
                      <Input
                        id="fundingAmount"
                        {...register("fundingAmount", {
                          validate: (value: unknown) =>
                            opportunityType !== "grant" ||
                            (value && String(value).trim().length > 0) ||
                            "Funding amount is required",
                        })}
                        placeholder="e.g., Up to $50,000"
                        className={errors.fundingAmount ? "border-destructive" : ""}
                      />
                      {errors.fundingAmount && <p className="text-sm text-destructive mt-1">{(errors as any).fundingAmount.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="currency">Currency</Label>
                      <Input id="currency" {...register("currency")} placeholder="USD" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="deadline">Deadline *</Label>
                    <Input
                      id="deadline"
                      type="date"
                      {...register("deadline")}
                      className={errors.deadline ? "border-destructive" : ""}
                    />
                    {errors.deadline && <p className="text-sm text-destructive mt-1">{(errors as any).deadline.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="location">Location *</Label>
                    <Input
                      id="location"
                      {...register("location")}
                      placeholder="e.g., Kenya, Nigeria, All Africa"
                      className={errors.location ? "border-destructive" : ""}
                    />
                    {errors.location && <p className="text-sm text-destructive mt-1">{(errors as any).location.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Input id="country" {...register("country")} placeholder="e.g., Kenya" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="requirements">Requirements</Label>
                  <Textarea
                    id="requirements"
                    {...register("requirements")}
                    placeholder="Comma-separated requirements (e.g., Business plan, Pitch deck, Financials)"
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="eligibilityCriteria">Eligibility Criteria</Label>
                  <Textarea
                    id="eligibilityCriteria"
                    {...register("eligibilityCriteria")}
                    placeholder="Comma-separated eligibility (e.g., Women-led startup, Registered business)"
                    rows={4}
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-1.5 mb-2">
                    <Tag className="h-3.5 w-3.5" />
                    Tags
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Select existing tags or type a new one and press Enter to create it.
                  </p>
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
                  <div className="relative">
                    <div className="flex gap-2">
                      <Input
                        ref={tagInputRef}
                        value={tagInput}
                        onChange={(e) => {
                          setTagInput(e.target.value);
                          setShowSuggestions(true);
                        }}
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
                        onClick={() => {
                          if (tagInput.trim()) addTag(tagInput);
                        }}
                        disabled={!tagInput.trim()}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                    {showSuggestions &&
                      (tagSuggestions.length > 0 ||
                        (tagInput.trim() && !allTags.some((tag) => tag.name.toLowerCase() === tagInput.toLowerCase()))) && (
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
                        {tagInput.trim() && !allTags.some((tag) => tag.name.toLowerCase() === tagInput.toLowerCase()) && (
                          <button
                            type="button"
                            onMouseDown={() => addTag(tagInput)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors border-t border-border flex items-center gap-2"
                          >
                            <Plus className="h-3.5 w-3.5 text-primary" />
                            <span>Create &quot;<strong>{tagInput.trim()}</strong>&quot;</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {showImageSection && onImageUpload && onImageDelete && onImageChange && (
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Opportunity Image</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Upload an image for this opportunity (optional)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
                  <ImageUpload
                    value={imageUrl || undefined}
                    onChange={(url) => onImageChange(url || "")}
                    onUpload={onImageUpload}
                    onDelete={onImageDelete}
                    isUploading={isImageUploading}
                    uploadProgress={imageUploadProgress}
                    variant="banner"
                    placeholder="Upload Opportunity Image"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                  />
                  <p className="text-xs text-muted-foreground">Supported formats: JPG, PNG, WebP, GIF. Max size: 5MB</p>
                </CardContent>
              </Card>
            )}

            <OpportunityAttachmentsCard
              isEditing={!!isEditing}
              documents={documents}
              isUploading={isFilesUploading}
              upload={upload}
              remove={remove}
              pendingFiles={pendingFiles}
              setPendingFiles={setPendingFiles}
            />

            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Application Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
                <div>
                  <Label htmlFor="maxApplicants">Max Applicants</Label>
                  <Input
                    id="maxApplicants"
                    type="number"
                    min={1}
                    {...register("maxApplicants", { valueAsNumber: true })}
                    placeholder="Unlimited"
                    className={errors.maxApplicants ? "border-destructive" : ""}
                  />
                  {errors.maxApplicants && <p className="text-sm text-destructive mt-1">{(errors as any).maxApplicants?.message}</p>}
                  <p className="text-xs text-muted-foreground mt-1">Leave empty for unlimited applicants</p>
                </div>
                {showCurrentApplicants && (
                  <div>
                    <Label>Current Applicants</Label>
                    <p className="text-sm font-medium mt-1.5" aria-live="polite">
                      {currentApplicantsCount ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Read-only count from submitted applications.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {showApplicationState && applicationStateLabel != null && (
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Application Window State</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Derived from project status and deadline.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                  <p className="text-sm font-medium">{applicationStateLabel}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Applicants can apply and edit drafts only while this is open.
                  </p>
                </CardContent>
              </Card>
            )}

            {showFeatured && (
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
                    Featured Opportunity
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="featured">Show on Homepage</Label>
                      <p className="text-xs text-muted-foreground">Featured opportunities appear on the landing page</p>
                    </div>
                    <Switch
                      id="featured"
                      checked={watch("featured") ?? false}
                      onCheckedChange={(checked) => setValue("featured", checked as any)}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-4 pt-6 sm:p-6">
                <div className="space-y-2">
                  <Button type="submit" className="w-full min-h-[44px]" disabled={isSubmitting}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSubmitting ? "Saving..." : isEditing ? "Update Opportunity" : "Create Opportunity"}
                  </Button>
                  <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={onBack}>
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
}
