import type { TFunction } from "i18next";
import * as z from "zod";
import { emailSchema } from "@/lib/emailValidation";
import { isValidPhoneNumber } from "libphonenumber-js";

export const APPLICANT_TYPE_VALUES = [
  "Individual",
  "Organization",
  "Startup / SME",
  "NGO / Non-profit",
  "Research / Academic",
] as const;

export type ApplicantTypeValue = (typeof APPLICANT_TYPE_VALUES)[number];

export const countWords = (text: string): number => {
  if (!text?.trim()) return 0;
  return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
};

export function createApplicationFormSchemas(t: TFunction<"dashboard">) {
  const v = (key: string) => t(`applications.form.validation.${key}`);

  const phoneNumberSchema = z
    .string()
    .min(1, v("phoneRequired"))
    .refine(
      (value) => {
        if (!value) return false;
        try {
          return isValidPhoneNumber(value);
        } catch {
          return false;
        }
      },
      { message: v("phoneInvalid") },
    );

  const step1Schema = z.object({
    applicantType: z.enum(APPLICANT_TYPE_VALUES, {
      required_error: v("applicantTypeRequired"),
    }),
    fullLegalName: z.string().min(1, v("fullLegalNameRequired")),
    organizationName: z.string().optional(),
    countryOfResidence: z.string().min(2, v("countryRequired")),
    cityRegion: z.string().min(1, v("cityRegionRequired")),
    emailAddress: emailSchema,
    phoneNumber: phoneNumberSchema,
  });

  const step2BaseSchema = z.object({
    yearEstablished: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : Number(val)),
      z
        .number()
        .min(1900, v("yearInvalid"))
        .max(new Date().getFullYear(), v("yearFuture"))
        .optional(),
    ),
    coreMissionPurpose: z
      .string()
      .optional()
      .refine((val) => !val || countWords(val) <= 200, {
        message: v("coreMissionMaxWords"),
      }),
    primarysectors: z.array(z.string()).optional(),
    primarysectorOther: z.string().optional(),
    numberOfTeamMembers: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : Number(val)),
      z.number().min(1, v("teamMembersMin")).optional(),
    ),
    keyTeamMembersRoles: z
      .string()
      .optional()
      .refine((val) => !val || countWords(val) <= 200, {
        message: v("keyTeamMaxWords"),
      }),
    previousGrantsFundingReceived: z.boolean().default(false),
    previousGrantsFundingDetails: z
      .string()
      .optional()
      .refine((val) => !val || countWords(val) <= 400, {
        message: v("previousGrantsMaxWords"),
      }),
  });

  const step2GrantSchema = step2BaseSchema.refine(
    (data) => {
      if (data.previousGrantsFundingReceived && !data.previousGrantsFundingDetails) {
        return false;
      }
      return true;
    },
    {
      message: v("previousGrantsDetailsRequired"),
      path: ["previousGrantsFundingDetails"],
    },
  );

  const step3CoreSchema = z.object({
    projectTitle: z.string().min(1, v("projectTitleRequired")),
    projectSummary: z
      .string()
      .min(1, v("projectSummaryRequired"))
      .refine((val) => countWords(val) >= 30, { message: v("projectSummaryMinWords") })
      .refine((val) => countWords(val) <= 400, { message: v("projectSummaryMaxWords") }),
  });

  const step3GrantSchema = step3CoreSchema.extend({
    geographicFocus: z.string().optional(),
  });

  const step4BaseSchema = z.object({
    informationAccurateConfirmed: z.boolean().refine((val) => val === true, {
      message: v("informationAccurateRequired"),
    }),
    conflictOfInterestDeclared: z.boolean().refine((val) => val === true, {
      message: v("conflictOfInterestRequired"),
    }),
    dataProcessingConsented: z.boolean().refine((val) => val === true, {
      message: v("dataProcessingRequired"),
    }),
    declarationDate: z.date().optional(),
  });

  const step4GrantSchema = step4BaseSchema.extend({
    reportingRequirementsAgreed: z.boolean().refine((val) => val === true, {
      message: v("reportingRequirementsRequired"),
    }),
  });

  const socialLinksSchema = z.object({
    linkedinUrl: z
      .string()
      .optional()
      .refine((val) => !val || val === "" || z.string().url().safeParse(val).success, {
        message: v("linkedinUrlInvalid"),
      }),
    githubUrl: z
      .string()
      .optional()
      .refine((val) => !val || val === "" || z.string().url().safeParse(val).success, {
        message: v("githubUrlInvalid"),
      }),
    twitterUrl: z
      .string()
      .optional()
      .refine((val) => !val || val === "" || z.string().url().safeParse(val).success, {
        message: v("twitterUrlInvalid"),
      }),
    websiteUrl: z
      .string()
      .optional()
      .refine((val) => !val || val === "" || z.string().url().safeParse(val).success, {
        message: v("websiteUrlInvalid"),
      }),
    otherSocialLinks: z
      .string()
      .optional()
      .refine((val) => !val || countWords(val) <= 100, {
        message: v("otherSocialMaxWords"),
      }),
  });

  const documentsSchema = z.object({
    documents: z.array(z.any()).optional(),
  });

  const getStep3Schema = (isGrantType: boolean) =>
    isGrantType ? step3GrantSchema : step3CoreSchema;

  const applicationSchema = step1Schema
    .merge(step2GrantSchema as z.ZodObject<z.ZodRawShape>)
    .merge(step3GrantSchema)
    .merge(step4GrantSchema)
    .merge(socialLinksSchema)
    .merge(documentsSchema);

  return {
    step1Schema,
    step2BaseSchema,
    step2GrantSchema,
    step3CoreSchema,
    step3GrantSchema,
    step4BaseSchema,
    step4GrantSchema,
    socialLinksSchema,
    documentsSchema,
    getStep3Schema,
    applicationSchema,
  };
}

export type ApplicationFormValues = z.infer<
  ReturnType<typeof createApplicationFormSchemas>["applicationSchema"]
>;
