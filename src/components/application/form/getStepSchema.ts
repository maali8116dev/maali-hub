import type { TFunction } from "i18next";
import * as z from "zod";
import { createApplicationFormSchemas } from "@/lib/schemas/applicationForm.schema";

export function getStepSchema(
  t: TFunction<"dashboard">,
  currentStep: number,
  applicantType?: string,
  opportunityType?: string | null,
): z.ZodSchema {
  const isGrantType = opportunityType === "grant";
  const {
    step1Schema,
    step2BaseSchema,
    step2GrantSchema,
    socialLinksSchema,
    step4BaseSchema,
    step4GrantSchema,
    getStep3Schema,
  } = createApplicationFormSchemas(t);

  switch (currentStep) {
    case 1:
      return step1Schema;
    case 2:
      if (applicantType === "Individual") return z.object({});
      return isGrantType ? step2GrantSchema : step2BaseSchema;
    case 3:
      return getStep3Schema(isGrantType);
    case 4:
      return socialLinksSchema;
    case 5:
      return z.object({});
    case 6:
      return z.object({});
    case 7:
      return isGrantType ? step4GrantSchema : step4BaseSchema;
    default:
      return z.object({});
  }
}
