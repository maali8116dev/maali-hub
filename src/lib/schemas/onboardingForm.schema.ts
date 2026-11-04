import type { TFunction } from "i18next";
import * as z from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";

export function createOnboardingProfileSchema(t: TFunction<"common">) {
  const v = (key: string) => t(`onboarding.validation.${key}`);

  return z.object({
    firstName: z.string().min(1, v("firstNameRequired")),
    lastName: z.string().min(1, v("lastNameRequired")),
    organisationName: z.string().optional(),
    sector: z.string().min(1, v("sectorRequired")),
    country: z.string().min(1, v("countryRequired")),
    cityRegion: z.string().min(1, v("cityRegionRequired")),
    phoneNumber: z
      .string()
      .min(1, v("phoneRequired"))
      .refine(
        (value) => {
          try {
            return isValidPhoneNumber(value);
          } catch {
            return false;
          }
        },
        { message: v("phoneInvalid") },
      ),
    bio: z.string().optional(),
    avatarUrl: z.string().optional(),
  });
}

export type OnboardingProfileFormValues = z.infer<
  ReturnType<typeof createOnboardingProfileSchema>
>;
