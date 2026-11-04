import type { TFunction } from "i18next";
import * as z from "zod";

export function createPartnerSetupSchemas(t: TFunction<"dashboard">) {
  const v = (key: string) => t(`partner.setupWizard.validation.${key}`);

  const step1Schema = z.object({
    description: z.string().min(10, v("descriptionMin")),
    website_url: z.string().url(v("validUrl")).or(z.literal("")).optional(),
  });

  const step2Schema = z.object({
    contactName: z.string().min(2, v("contactNameMin")),
    contactPhone: z.string().optional(),
    country: z.string().optional(),
  });

  const step3Schema = z.object({
    opportunityTitle: z.string().optional(),
    fundingAmount: z.string().optional(),
    deadline: z.string().optional(),
  });

  return { step1Schema, step2Schema, step3Schema };
}

export type Step1Values = z.infer<
  ReturnType<typeof createPartnerSetupSchemas>["step1Schema"]
>;
export type Step2Values = z.infer<
  ReturnType<typeof createPartnerSetupSchemas>["step2Schema"]
>;
export type Step3Values = z.infer<
  ReturnType<typeof createPartnerSetupSchemas>["step3Schema"]
>;
