import { RefObject, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Save, Star, Tag, X } from "lucide-react";
import { FieldErrors, UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/ui/image-upload";
import { OpportunityAttachmentsCard } from "@/components/opportunity/OpportunityAttachmentsCard";
import CustomFormField, { FormFieldType } from "@/components/form/CustomFormField";
import { COUNTRIES } from "@/components/application/form/countries";
import { OPPORTUNITY_TYPE_VALUES } from "@/lib/schemas/opportunityForm.schema";
import type { OpportunityFormRole } from "@/lib/schemas/opportunityForm.schema";
import { getLocalizedSectorName } from "@/lib/localizedSector";

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
  role: OpportunityFormRole;
  form: UseFormReturn<T>;
  backHref: string;
  onBack: () => void;
  isEditing: boolean;
  isSubmitting: boolean;
  isLoading?: boolean;
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
    role,
    form,
    backHref,
    onBack,
    isEditing,
    isSubmitting,
    isLoading = false,
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

  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();
  const { watch, setValue, formState, handleSubmit, control } = form as UseFormReturn<any>;

  const pageTitle = isEditing
    ? t("opportunities.form.titleEdit")
    : t("opportunities.form.titleCreate");
  const pageSubtitle = isEditing
    ? t(role === "admin" ? "opportunities.form.subtitleEditAdmin" : "opportunities.form.subtitleEditPartner")
    : t(role === "admin" ? "opportunities.form.subtitleCreateAdmin" : "opportunities.form.subtitleCreatePartner");
  const backLabel = t(role === "admin" ? "opportunities.form.backAdmin" : "opportunities.form.backPartner");

  const typeOptions = useMemo(
    () =>
      OPPORTUNITY_TYPE_VALUES.map((value) => ({
        value,
        label: t(`opportunities.form.types.${value}`),
      })),
    [t],
  );

  const statusOptions = useMemo(() => {
    const values = role === "admin"
      ? (["new", "open", "closing-soon", "closed", "archived"] as const)
      : (["new", "open", "closing-soon", "closed"] as const);
    return values.map((value) => ({
      value,
      label: t(`opportunities.form.statuses.${value}`),
    }));
  }, [role, t]);

  const sectorOptions = useMemo(
    () =>
      sectors.map((sector) => ({
        value: sector.id.toString(),
        label: getLocalizedSectorName(sector.name, t),
      })),
    [sectors, t],
  );

  const countryOptions = useMemo(
    () => COUNTRIES.map(({ value, label }) => ({ value, label })),
    [],
  );

  const onInvalid = (fieldErrors: FieldErrors) => {
    const first = Object.values(fieldErrors).find(
      (e) => e && typeof e === "object" && "message" in e && e.message
    ) as { message?: string } | undefined;
    toast({
      title: t("opportunities.form.toast.invalidTitle"),
      description: first?.message ?? t("opportunities.form.toast.invalidDescription"),
      variant: "destructive",
    });
  };
  const opportunityType = watch("opportunityType");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">{t("opportunities.form.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{pageTitle}</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">{pageSubtitle}</p>
        </div>
        <Button variant="ghost" onClick={onBack} className="w-full sm:w-auto min-h-[44px]">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {backLabel}
        </Button>
      </div>

      <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit, onInvalid)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">{t("opportunities.form.sections.information.title")}</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  {t("opportunities.form.sections.information.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
                <CustomFormField
                  control={control}
                  name="title"
                  label={t("opportunities.form.fields.title.label")}
                  fieldType={FormFieldType.INPUT}
                  placeholder={t("opportunities.form.fields.title.placeholder")}
                  required
                />

                <FormField
                  control={control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("opportunities.form.fields.description.label")} *</FormLabel>
                      <FormControl>
                        <RichTextEditor
                          value={field.value}
                          onChange={(value) => field.onChange(value)}
                          placeholder={t("opportunities.form.fields.description.placeholder")}
                          error={!!formState.errors.description}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={control}
                    name="opportunityType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("opportunities.form.fields.opportunityType.label")} *</FormLabel>
                        <Select
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("opportunities.form.fields.opportunityType.placeholder")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {typeOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="sectorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("opportunities.form.fields.sector.label")}</FormLabel>
                        <Select
                          value={field.value?.toString() ?? ""}
                          onValueChange={(value) =>
                            field.onChange(value ? parseInt(value, 10) : undefined)
                          }
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("opportunities.form.fields.sector.placeholder")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {sectorOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <CustomFormField
                    control={control}
                    name="status"
                    label={t("opportunities.form.fields.status.label")}
                    fieldType={FormFieldType.SELECT}
                    placeholder={t("opportunities.form.fields.status.placeholder")}
                    options={statusOptions}
                    required
                  />
                </div>

                {opportunityType === "grant" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <CustomFormField
                      control={control}
                      name="fundingAmount"
                      label={t("opportunities.form.fields.fundingAmount.label")}
                      fieldType={FormFieldType.INPUT}
                      placeholder={t("opportunities.form.fields.fundingAmount.placeholder")}
                      required
                    />
                    <CustomFormField
                      control={control}
                      name="currency"
                      label={t("opportunities.form.fields.currency.label")}
                      fieldType={FormFieldType.INPUT}
                      placeholder={t("opportunities.form.fields.currency.placeholder")}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={control}
                    name="deadline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("opportunities.form.fields.deadline.label")} *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <CustomFormField
                    control={control}
                    name="location"
                    label={t("opportunities.form.fields.location.label")}
                    fieldType={FormFieldType.INPUT}
                    placeholder={t("opportunities.form.fields.location.placeholder")}
                    required
                  />
                </div>

                <CustomFormField
                  control={control}
                  name="country"
                  label={t("opportunities.form.fields.country.label")}
                  fieldType={FormFieldType.SELECT}
                  placeholder={t("opportunities.form.fields.country.placeholder")}
                  options={countryOptions}
                />

                <CustomFormField
                  key={`requirements-${i18n.language}`}
                  control={control}
                  name="requirements"
                  label={t("opportunities.form.fields.requirements.label")}
                  fieldType={FormFieldType.TEXTAREA}
                  placeholder={t("opportunities.form.fields.requirements.placeholder")}
                  rows={4}
                />

                <CustomFormField
                  key={`eligibility-${i18n.language}`}
                  control={control}
                  name="eligibilityCriteria"
                  label={t("opportunities.form.fields.eligibilityCriteria.label")}
                  fieldType={FormFieldType.TEXTAREA}
                  placeholder={t("opportunities.form.fields.eligibilityCriteria.placeholder")}
                  rows={4}
                />

                <div>
                  <Label className="flex items-center gap-1.5 mb-2">
                    <Tag className="h-3.5 w-3.5" />
                    {t("opportunities.form.fields.tags.label")}
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    {t("opportunities.form.fields.tags.hint")}
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
                            aria-label={t("opportunities.form.fields.tags.remove", { tag })}
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
                        placeholder={t("opportunities.form.fields.tags.placeholder")}
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
                        {t("opportunities.form.fields.tags.add")}
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
                            <span>{t("opportunities.form.fields.tags.create", { tag: tagInput.trim() })}</span>
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
                  <CardTitle className="text-base sm:text-lg">{t("opportunities.form.sections.image.title")}</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">{t("opportunities.form.sections.image.description")}</CardDescription>
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
                    placeholder={t("opportunities.form.sections.image.uploadPlaceholder")}
                    dropzoneHint={t("opportunities.form.sections.image.dropzoneHint")}
                    formatsHint={t("opportunities.form.sections.image.formats")}
                    changeLabel={t("opportunities.form.sections.image.change")}
                    loadingLabel={t("opportunities.form.sections.image.loading")}
                    accept="image/jpeg,image/png,image/webp,image/gif"
                  />
                </CardContent>
              </Card>
            )}

            <OpportunityAttachmentsCard
              isEditing={!!isEditing}
              documents={documents as any}
              isUploading={isFilesUploading}
              upload={upload as any}
              remove={remove as any}
              pendingFiles={pendingFiles}
              setPendingFiles={setPendingFiles}
            />

            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">{t("opportunities.form.sections.applicationSettings.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
                <CustomFormField
                  control={control}
                  name="maxApplicants"
                  label={t("opportunities.form.fields.maxApplicants.label")}
                  fieldType={FormFieldType.NUMBER}
                  placeholder={t("opportunities.form.fields.maxApplicants.placeholder")}
                  min={1}
                  description={t("opportunities.form.fields.maxApplicants.hint")}
                />
                {showCurrentApplicants && (
                  <div>
                    <Label>{t("opportunities.form.fields.currentApplicants.label")}</Label>
                    <p className="text-sm font-medium mt-1.5" aria-live="polite">
                      {currentApplicantsCount ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("opportunities.form.fields.currentApplicants.hint")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {showApplicationState && applicationStateLabel != null && (
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">{t("opportunities.form.sections.applicationWindow.title")}</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">{t("opportunities.form.sections.applicationWindow.description")}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                  <p className="text-sm font-medium">{applicationStateLabel}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("opportunities.form.sections.applicationWindow.hint")}
                  </p>
                </CardContent>
              </Card>
            )}

            {showFeatured && (
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Star className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
                    {t("opportunities.form.sections.featured.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="featured">{t("opportunities.form.sections.featured.label")}</Label>
                      <p className="text-xs text-muted-foreground">{t("opportunities.form.sections.featured.hint")}</p>
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
                    {isSubmitting
                      ? t("opportunities.form.actions.saving")
                      : isEditing
                        ? t("opportunities.form.actions.update")
                        : t("opportunities.form.actions.create")}
                  </Button>
                  <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={onBack}>
                    {t("opportunities.form.actions.cancel")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
      </Form>
    </div>
  );
}
