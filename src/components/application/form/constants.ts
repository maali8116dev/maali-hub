import type { TFunction } from "i18next";
import { APPLICANT_TYPE_VALUES } from "@/lib/schemas/applicationForm.schema";

const SECTOR_VALUES = [
  "Health",
  "Education",
  "Technology",
  "Agriculture",
  "Environment",
  "Creative",
  "Other",
] as const;

export function getStepTitles(t: TFunction<"dashboard">): string[] {
  return [
    t("applications.form.steps.applicantInfo"),
    t("applications.form.steps.organization"),
    t("applications.form.steps.projectOverview"),
    t("applications.form.steps.socialLinks"),
    t("applications.form.steps.documents"),
    t("applications.form.steps.review"),
    t("applications.form.steps.compliance"),
    t("applications.form.steps.submit"),
  ];
}

export function getApplicantTypeOptions(t: TFunction<"dashboard">) {
  return APPLICANT_TYPE_VALUES.map((value) => ({
    value,
    label: t(`applications.form.options.applicantTypes.${value}`),
  }));
}

export function getPrimarySectorOptions(t: TFunction<"dashboard">) {
  return SECTOR_VALUES.map((value) => ({
    value,
    label: t(`applications.form.options.sectors.${value}`),
  }));
}

export interface ProjectOverviewCopy {
  sectionTitle: string;
  sectionHint: string;
  titleLabel: string;
  titlePlaceholder: string;
  summaryLabel: string;
  summaryPlaceholder: string;
  locationLabel: string;
  locationPlaceholder: string;
}

export function getProjectOverviewCopy(
  t: TFunction<"dashboard">,
  isGrantType = true,
): ProjectOverviewCopy {
  const prefix = isGrantType ? "applications.form.step3.grant" : "applications.form.step3.nonGrant";
  return {
    sectionTitle: t(`${prefix}.title`),
    sectionHint: t(`${prefix}.hint`),
    titleLabel: t(`${prefix}.titleLabel`),
    titlePlaceholder: t(`${prefix}.titlePlaceholder`),
    summaryLabel: t(`${prefix}.summaryLabel`),
    summaryPlaceholder: t(`${prefix}.summaryPlaceholder`),
    locationLabel: t(`${prefix}.locationLabel`),
    locationPlaceholder: t(`${prefix}.locationPlaceholder`),
  };
}

/** @deprecated Use getApplicantTypeOptions(t) */
export const APPLICANT_TYPES = APPLICANT_TYPE_VALUES.map((value) => ({
  value,
  label: value,
}));

/** @deprecated Use getPrimarySectorOptions(t) */
export const PRIMARY_sectorS = SECTOR_VALUES.map((value) => ({ value, label: value }));

/** @deprecated Use getStepTitles(t) */
export const stepTitles = [
  "Applicant Information",
  "Organization Details (Optional)",
  "Project Overview",
  "Social Links",
  "Upload Documents",
  "Review",
  "Compliance & Declarations",
  "Submit",
];
