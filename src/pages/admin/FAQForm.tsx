import { useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { useFAQ, useCreateFAQ, useUpdateFAQ, useAdminFAQs } from "@/hooks/useFAQs";
import { BackButton } from "@/components/ui/back-button";
import { useTranslation } from "react-i18next";

type FAQFormValues = {
  question: string;
  answer: string;
  sector: string;
  display_order: number;
  is_published: boolean;
};

const DEFAULT_sectors = [
  "General",
  "Applications",
  "Payments",
  "Account & Profile",
  "Funding",
  "Technical Support",
];

const FAQForm = () => {
  const { t, i18n } = useTranslation(["dashboard"]);
  const ff = "admin.cmsForm.faq";
  const fc = "admin.cmsForm.common";
  const fv = "admin.cmsForm.validation";

  const faqSchema = useMemo(
    () =>
      z.object({
        question: z
          .string()
          .min(1, t(`${fv}.required`, { field: t(`${ff}.question`) }))
          .min(10, t(`${fv}.minChars`, { field: t(`${ff}.question`), min: 10 })),
        answer: z
          .string()
          .min(1, t(`${fv}.required`, { field: t(`${ff}.answer`) }))
          .min(20, t(`${fv}.minChars`, { field: t(`${ff}.answer`), min: 20 })),
        sector: z.string().min(1, t(`${fv}.required`, { field: t(`${ff}.sector`) })),
        display_order: z.number().min(0, t(`${fv}.displayOrderMin`)),
        is_published: z.boolean(),
      }),
    [t, i18n.language]
  );

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;
  const faqId = id ? parseInt(id, 10) : undefined;

  const { data: faq, isLoading: isLoadingFAQ } = useFAQ(faqId);
  const { data: allFAQs } = useAdminFAQs();
  const createFAQ = useCreateFAQ();
  const updateFAQ = useUpdateFAQ();

  // Get existing sectors from FAQs
  const existingsectors = allFAQs
    ? [...new Set(allFAQs.map((f) => f.sector))]
    : [];
  const sectors = [...new Set([...DEFAULT_sectors, ...existingsectors])].sort();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
  } = useForm<FAQFormValues>({
    resolver: zodResolver(faqSchema),
    defaultValues: {
      question: "",
      answer: "",
      sector: "",
      display_order: 0,
      is_published: true,
    },
  });

  const isPublished = watch("is_published");
  const selectedCategory = watch("sector");

  useEffect(() => {
    if (faq && isEditing) {
      reset({
        question: faq.question,
        answer: faq.answer,
        sector: faq.sector,
        display_order: faq.display_order,
        is_published: faq.is_published,
      });
    }
  }, [faq, isEditing, reset]);

  const onSubmit = async (data: FAQFormValues) => {
    const faqData = {
      question: data.question,
      answer: data.answer,
      sector: data.sector,
      display_order: data.display_order,
      is_published: data.is_published,
    };
    
    if (isEditing && faqId) {
      await updateFAQ.mutateAsync({ id: faqId, faq: faqData });
    } else {
      await createFAQ.mutateAsync(faqData);
    }
    navigate("/admin/faq");
  };

  if (isEditing && isLoadingFAQ) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {isEditing ? t(`${ff}.editTitle`) : t(`${ff}.createTitle`)}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isEditing ? t(`${ff}.editDesc`) : t(`${ff}.createDesc`)}
          </p>
        </div>
        <BackButton label={t(`${fc}.back`)} link="/admin/faq" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>FAQ Content</CardTitle>
                <CardDescription>Enter the question and answer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="question">{t(`${ff}.question`)} *</Label>
                  <Input
                    id="question"
                    {...register("question")}
                    placeholder="Enter the frequently asked question"
                    className={errors.question ? "border-destructive" : ""}
                  />
                  {errors.question && (
                    <p className="text-sm text-destructive mt-1">{errors.question.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="answer">{t(`${ff}.answer`)} *</Label>
                  <Textarea
                    id="answer"
                    {...register("answer")}
                    placeholder="Write a clear and helpful answer"
                    rows={8}
                    className={errors.answer ? "border-destructive" : ""}
                  />
                  {errors.answer && (
                    <p className="text-sm text-destructive mt-1">{errors.answer.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    You can use plain text or markdown formatting
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Publish Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Publish Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="is_published">{t(`${ff}.isPublished`)}</Label>
                    <p className="text-xs text-muted-foreground">Make this FAQ visible to users</p>
                  </div>
                  <Switch
                    id="is_published"
                    checked={isPublished}
                    onCheckedChange={(checked) => setValue("is_published", checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* FAQ Details */}
            <Card>
              <CardHeader>
                <CardTitle>FAQ Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="sector">{t(`${ff}.sector`)} *</Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={(value) => setValue("sector", value)}
                  >
                    <SelectTrigger id="sector" className={errors.sector ? "border-destructive" : ""}>
                      <SelectValue placeholder={t(`${ff}.selectSector`)} />
                    </SelectTrigger>
                    <SelectContent>
                      {sectors.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.sector && (
                    <p className="text-sm text-destructive mt-1">{errors.sector.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="display_order">{t(`${ff}.displayOrder`)}</Label>
                  <Input
                    id="display_order"
                    type="number"
                    {...register("display_order", { valueAsNumber: true })}
                    placeholder="0"
                    min={0}
                    className={errors.display_order ? "border-destructive" : ""}
                  />
                  {errors.display_order && (
                    <p className="text-sm text-destructive mt-1">{errors.display_order.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Lower numbers appear first within a sector
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting || createFAQ.isPending || updateFAQ.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSubmitting || createFAQ.isPending || updateFAQ.isPending
                      ? t(`${fc}.saving`)
                      : isEditing
                      ? t(`${fc}.save`)
                      : t(`${fc}.create`)}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate("/admin/faq")}
                  >
                    {t(`${fc}.cancel`)}
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

export default FAQForm;








