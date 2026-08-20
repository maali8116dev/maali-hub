import type { TFunction } from "i18next";
import { z } from "zod";

export const OPPORTUNITY_TYPE_VALUES = [
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

const optionalNumber = (schema: z.ZodNumber, message: string) =>
  z.preprocess((val) => {
    if (val === "" || val === null || (typeof val === "number" && Number.isNaN(val))) {
      return undefined;
    }
    return val;
  }, schema.optional());

const optionalSectorId = (invalidMessage: string) =>
  z.preprocess(
    (val) => {
      if (val === "" || val === null || (typeof val === "number" && Number.isNaN(val))) {
        return undefined;
      }
      return val;
    },
    z.number({ invalid_type_error: invalidMessage }).int().optional(),
  );

export type OpportunityFormRole = "admin" | "partner";

export function createOpportunitySchema(
  t: TFunction<"dashboard">,
  options: { role: OpportunityFormRole },
) {
  const v = (key: string) => t(`opportunities.form.validation.${key}`);

  const statusEnum =
    options.role === "admin"
      ? z.enum(["new", "open", "closing-soon", "closed", "archived"])
      : z.enum(["new", "open", "closing-soon", "closed"]);

  const descriptionSchema =
    options.role === "partner"
      ? z
          .string()
          .min(1, v("descriptionRequired"))
          .refine((val) => plainTextLength(val) >= 50, v("descriptionMin"))
      : z
          .string()
          .min(1, v("descriptionRequired"))
          .min(50, v("descriptionMin"));

  const opportunityTypeSchema =
    options.role === "partner"
      ? z.preprocess(
          (val) => (val === "" || val === null ? undefined : val),
          z.enum(OPPORTUNITY_TYPE_VALUES, { required_error: v("opportunityTypeRequired") }),
        )
      : z
          .enum(OPPORTUNITY_TYPE_VALUES)
          .nullable()
          .optional();

  const base = z.object({
    title: z.string().min(1, v("titleRequired")).min(5, v("titleMin")),
    description: descriptionSchema,
    sectorId: optionalSectorId(v("sectorInvalid")),
    opportunityType: opportunityTypeSchema,
    status: statusEnum,
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, v("deadlineFormat")),
    fundingAmount: z.string().optional(),
    currency: z.string().optional(),
    location: z.string().min(1, v("locationRequired")),
    country: z.string().optional(),
    imageUrl: z.string().optional().or(z.literal("")),
    requirements: z.string().optional(),
    eligibilityCriteria: z.string().optional(),
    maxApplicants: optionalNumber(
      z.number().int().positive(v("maxApplicantsPositive")),
      v("maxApplicantsPositive"),
    ),
  });

  const fundingRefine = <T extends z.ZodTypeAny>(schema: T) =>
    schema.refine(
      (data: z.infer<typeof base>) =>
        data.opportunityType !== "grant" ||
        (data.fundingAmount != null && String(data.fundingAmount).trim().length > 0),
      { message: v("fundingAmountRequired"), path: ["fundingAmount"] },
    );

  if (options.role === "admin") {
    return fundingRefine(
      base.extend({
        currentApplicants: optionalNumber(
          z.number().int().min(0, v("currentApplicantsMin")),
          v("currentApplicantsMin"),
        ),
        featured: z.boolean().optional(),
      }),
    );
  }

  return fundingRefine(base);
}

export type OpportunityFormValues = z.infer<ReturnType<typeof createOpportunitySchema>>;
