import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePartnerOpportunity, useCreatePartnerOpportunity, useUpdatePartnerOpportunity, PartnerOpportunityFormData } from "@/hooks/usePartnerOpportunities";
import { useCategories } from "@/hooks/useCategories";

const schema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(50, "Description must be at least 50 characters"),
  status: z.enum(["new", "open", "closing-soon", "closed"]),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline must be YYYY-MM-DD"),
  fundingAmount: z.string().min(1, "Funding amount is required"),
  location: z.string().min(1, "Location is required"),
  requirements: z.string().optional(),
  eligibilityCriteria: z.string().optional(),
  maxApplicants: z.preprocess((v) => (v === "" || v === null || (typeof v === "number" && isNaN(v)) ? undefined : v), z.number().int().positive().optional()),
  currency: z.string().optional(),
  country: z.string().optional(),
  organizationName: z.string().optional(),
  categoryId: z.preprocess((v) => (v === "" || v === null || (typeof v === "number" && isNaN(v)) ? undefined : v), z.number().int().optional()),
  opportunityType: z.enum(["grant", "fellowship", "scholarship", "internship", "training", "competition", "accelerator", "incubator", "job"]).default("grant"),
});

type FormValues = z.infer<typeof schema>;

const PartnerOpportunityForm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;
  const opportunityId = id ? parseInt(id) : undefined;

  const { data: opportunity, isLoading } = usePartnerOpportunity(opportunityId);
  const { data: categories = [] } = useCategories();
  const createOpp = useCreatePartnerOpportunity();
  const updateOpp = useUpdatePartnerOpportunity();

  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", status: "open", deadline: "", fundingAmount: "", location: "", requirements: "", eligibilityCriteria: "", currency: "USD", country: "", organizationName: "", opportunityType: "grant" },
  });

  const status = watch("status");
  const categoryId = watch("categoryId");

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
              <Textarea id="description" {...register("description")} rows={6} className={errors.description ? "border-destructive" : ""} />
              {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="fundingAmount">Funding Amount *</Label>
                <Input id="fundingAmount" {...register("fundingAmount")} className={errors.fundingAmount ? "border-destructive" : ""} />
                {errors.fundingAmount && <p className="text-sm text-destructive mt-1">{errors.fundingAmount.message}</p>}
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" {...register("currency")} placeholder="USD" />
              </div>
              <div>
                <Label htmlFor="applicationFee">Application Fee</Label>
                <Input id="applicationFee" type="number" step="0.01" min="0" {...register("applicationFee", { valueAsNumber: true })} />
                <p className="text-xs text-muted-foreground mt-1">Leave empty for free</p>
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
