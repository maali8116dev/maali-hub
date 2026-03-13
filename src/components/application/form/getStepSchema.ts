/**
 * Helper to get the appropriate schema for each step
 */
import * as z from "zod";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step5Schema,
  step4Schema as complianceSchema,
} from "./schemas";

export function getStepSchema(
  currentStep: number,
  applicantType?: string
): z.ZodSchema {
  switch (currentStep) {
    case 1:
      return step1Schema;
    case 2:
      // Step 2 is only required for non-Individual applicants
      return applicantType === "Individual" ? z.object({}) : step2Schema;
    case 3:
      return step3Schema;
    case 4:
      return step5Schema; // Social Links
    case 5:
      return z.object({}); // Documents (no schema validation)
    case 6:
      return z.object({}); // Review (no schema)
    case 7:
      return complianceSchema; // Compliance & Declarations
    default:
      return z.object({}); // Submit or other steps
  }
}









