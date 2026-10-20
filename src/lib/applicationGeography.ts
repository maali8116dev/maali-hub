import type { ApplicationFormData } from "@/stores/applicationForm";

/** Applicant location from step 1 (used when project geography is not collected). */
export function applicantLocationLabel(
  formData: Pick<ApplicationFormData, "cityRegion" | "countryOfResidence">,
): string {
  return [formData.cityRegion, formData.countryOfResidence]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Non-grant: always from city + country.
 * Grant: use optional project geography, else fall back to applicant location.
 */
export function resolveGeographicFocus(
  formData: Pick<
    ApplicationFormData,
    "geographicFocus" | "cityRegion" | "countryOfResidence"
  >,
  isGrantType: boolean,
): string | null {
  const applicant = applicantLocationLabel(formData);
  if (!isGrantType) {
    return applicant || null;
  }
  const project = formData.geographicFocus?.trim();
  return project || applicant || null;
}
