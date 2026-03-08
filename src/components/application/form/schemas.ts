import * as z from "zod";
import { emailSchema } from "@/lib/emailValidation";
import { isValidPhoneNumber } from "libphonenumber-js";

// Helper function to count words in a string
export const countWords = (text: string): number => {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
};

// Phone number validation schema
export const phoneNumberSchema = z
  .string()
  .min(1, "Phone number is required")
  .refine(
    (value) => {
      if (!value) return false;
      try {
        return isValidPhoneNumber(value);
      } catch {
        return false;
      }
    },
    {
      message: "Please enter a valid international phone number",
    }
  );

// Step 1: Applicant Information Schema
export const step1Schema = z.object({
  applicantType: z.enum(
    [
      "Individual",
      "Organization",
      "Startup / SME",
      "NGO / Non-profit",
      "Research / Academic",
    ],
    {
      required_error: "Please select an applicant type",
    }
  ),
  fullLegalName: z
    .string()
    .min(1, "Full legal name is required"),
  organizationName: z.string().optional(),
  
  countryOfResidence: z.string().min(2, "Country of residence is required"),
  cityRegion: z.string().min(1, "City/region is required"),
  emailAddress: emailSchema,
  phoneNumber: phoneNumberSchema,
});

// Step 2: Organizational Background Schema (conditional - only required if not Individual)
export const step2Schema = z
  .object({
    yearEstablished: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : Number(val)),
      z
        .number()
        .min(1900, "Please enter a valid year")
        .max(new Date().getFullYear(), "Year cannot be in the future")
        .optional()
    ),
    coreMissionPurpose: z
      .string()
      .optional()
      .refine((val) => !val || countWords(val) <= 200, {
        message: "Core mission / purpose must not exceed 200 words",
      }),
    primarySectors: z.array(z.string()).optional(),
    primarySectorOther: z.string().optional(),
    numberOfTeamMembers: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : Number(val)),
      z.number().min(1, "Number of team members must be at least 1").optional()
    ),
    keyTeamMembersRoles: z
      .string()
      .optional()
      .refine((val) => !val || countWords(val) <= 200, {
        message: "Key team members & roles must not exceed 200 words",
      }),
    previousGrantsFundingReceived: z.boolean().default(false),
    previousGrantsFundingDetails: z
      .string()
      .optional()
      .refine((val) => !val || countWords(val) <= 400, {
        message: "Previous grants / funding details must not exceed 400 words",
      }),
  })
  .refine(
    (data) => {
      // If previous grants received is true, details are required
      if (
        data.previousGrantsFundingReceived &&
        !data.previousGrantsFundingDetails
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Please provide details about previous grants or funding",
      path: ["previousGrantsFundingDetails"],
    }
  );

// Step 3: Project Overview Schema
export const step3Schema = z.object({
  projectTitle: z
    .string()
    .min(1, "Project title is required"),
  projectSummary: z
    .string()
    .min(1, "Project summary is required")
    .refine((val) => countWords(val) >= 50, {
      message: "Project summary must be at least 50 words",
    })
    .refine((val) => countWords(val) <= 400, {
      message: "Project summary must not exceed 400 words",
    }),
  geographicFocus: z.string().min(2, "Geographic focus is required"),
});

// Step 4: Compliance & Declarations Schema
export const step4Schema = z.object({
  informationAccurateConfirmed: z.boolean().refine((val) => val === true, {
    message: "You must confirm that the information provided is accurate",
  }),
  conflictOfInterestDeclared: z.boolean().refine((val) => val === true, {
    message: "You must declare any conflicts of interest",
  }),
  reportingRequirementsAgreed: z.boolean().refine((val) => val === true, {
    message: "You must agree to reporting requirements",
  }),
  dataProcessingConsented: z.boolean().refine((val) => val === true, {
    message: "You must consent to data processing",
  }),
  declarationDate: z.date().optional(),
});

// Step 5: Social Links Schema (optional)
export const step5Schema = z.object({
  linkedinUrl: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === "" || z.string().url().safeParse(val).success,
      { message: "Please enter a valid LinkedIn URL" }
    ),
  githubUrl: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === "" || z.string().url().safeParse(val).success,
      { message: "Please enter a valid GitHub URL" }
    ),
  twitterUrl: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === "" || z.string().url().safeParse(val).success,
      { message: "Please enter a valid Twitter/X URL" }
    ),
  websiteUrl: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === "" || z.string().url().safeParse(val).success,
      { message: "Please enter a valid website URL" }
    ),
  otherSocialLinks: z
    .string()
    .optional()
    .refine((val) => !val || countWords(val) <= 100, {
      message: "Other social links must not exceed 100 words",
    }),
});

// Step 6: Documents Schema (optional)
export const step6Schema = z.object({
  documents: z.array(z.any()).optional(),
});

// Combined schema for final validation
// Note: step2Schema uses .refine() which returns ZodEffects, so we use type assertion for merge
export const applicationSchema = step1Schema
  .merge(step2Schema as any)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step5Schema)
  .merge(step6Schema);

export type ApplicationFormValues = z.infer<typeof applicationSchema>;

