import type { TFunction } from "i18next";
import * as z from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import { emailSchema } from "@/lib/emailValidation";

export const CONTACT_SUBJECT_OPTIONS = [
  "funding",
  "application",
  "partnership",
  "technical",
  "general",
] as const;

export function createContactFormSchema(t: TFunction<"common">) {
  const v = (key: string) => t(`contactPage.validation.${key}`);

  return z.object({
    firstName: z.string().min(1, v("firstNameRequired")).max(100, v("firstNameTooLong")),
    lastName: z.string().min(1, v("lastNameRequired")).max(100, v("lastNameTooLong")),
    email: emailSchema,
    phone: z
      .string()
      .optional()
      .refine(
        (value) => {
          if (!value) return true;
          try {
            return isValidPhoneNumber(value);
          } catch {
            return false;
          }
        },
        { message: v("phoneInvalid") },
      ),
    country: z.string().optional(),
    subject: z.enum(CONTACT_SUBJECT_OPTIONS, {
      required_error: v("subjectRequired"),
    }),
    message: z.string().min(10, v("messageMin")).max(5000, v("messageTooLong")),
  });
}

export type ContactFormValues = z.infer<ReturnType<typeof createContactFormSchema>>;
