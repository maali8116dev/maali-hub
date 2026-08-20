export {
  countWords,
  APPLICANT_TYPE_VALUES,
  createApplicationFormSchemas,
  type ApplicationFormValues,
  type ApplicantTypeValue,
} from "@/lib/schemas/applicationForm.schema";

import type { TFunction } from "i18next";
import enDashboard from "@/locales/en/dashboard.json";
import { createApplicationFormSchemas } from "@/lib/schemas/applicationForm.schema";

/** English schemas for tests and non-React usage */
const validationT = ((key: string) => {
  const shortKey = key.replace("applications.form.validation.", "");
  const messages = (enDashboard.applications as { form: { validation: Record<string, string> } })
    .form.validation;
  return messages[shortKey] ?? key;
}) as TFunction<"dashboard">;

const englishSchemas = createApplicationFormSchemas(validationT);

export const step1Schema = englishSchemas.step1Schema;
export const step2BaseSchema = englishSchemas.step2BaseSchema;
export const step2Schema = englishSchemas.step2GrantSchema;
export const step3GrantSchema = englishSchemas.step3GrantSchema;
export const step3NonGrantSchema = englishSchemas.step3CoreSchema;
export const step3Schema = englishSchemas.step3GrantSchema;
export const step4BaseSchema = englishSchemas.step4BaseSchema;
export const step4Schema = englishSchemas.step4GrantSchema;
export const step5Schema = englishSchemas.socialLinksSchema;
export const step6Schema = englishSchemas.documentsSchema;
export const applicationSchema = englishSchemas.applicationSchema;

export function getStep3Schema(isGrantType: boolean) {
  return englishSchemas.getStep3Schema(isGrantType);
}
