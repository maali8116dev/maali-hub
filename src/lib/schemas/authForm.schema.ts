import type { TFunction } from "i18next";
import * as z from "zod";
import { emailSchema } from "@/lib/emailValidation";

const passwordField = (v: (key: string) => string) =>
  z
    .string()
    .min(8, v("minLength"))
    .regex(/[A-Z]/, v("uppercase"))
    .regex(/[a-z]/, v("lowercase"))
    .regex(/[0-9]/, v("number"))
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, v("special"));

export function createAuthSchemas(t: TFunction<"common">) {
  const v = (key: string) => t(`auth.validation.${key}`);

  const signInSchema = z.object({
    email: z.string().email(v("emailInvalid")),
    password: z.string().min(1, v("passwordRequired")),
  });

  const signUpSchema = z
    .object({
      firstName: z.string().min(2, v("firstNameMin")),
      lastName: z.string().min(2, v("lastNameMin")),
      email: emailSchema,
      password: passwordField(v),
      passwordConfirmation: z.string().min(8, v("passwordConfirmRequired")),
    })
    .refine((data) => data.password === data.passwordConfirmation, {
      message: v("passwordMismatch"),
      path: ["passwordConfirmation"],
    });

  const resetPasswordSchema = z
    .object({
      password: passwordField(v),
      passwordConfirmation: z.string().min(8, v("passwordConfirmRequired")),
    })
    .refine((data) => data.password === data.passwordConfirmation, {
      message: v("passwordMismatch"),
      path: ["passwordConfirmation"],
    });

  return { signInSchema, signUpSchema, resetPasswordSchema };
}

export type SignInFormValues = z.infer<
  ReturnType<typeof createAuthSchemas>["signInSchema"]
>;
export type SignUpFormValues = z.infer<
  ReturnType<typeof createAuthSchemas>["signUpSchema"]
>;
export type ResetPasswordFormValues = z.infer<
  ReturnType<typeof createAuthSchemas>["resetPasswordSchema"]
>;

export interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

export function createPasswordRequirements(t: TFunction<"common">): PasswordRequirement[] {
  const v = (key: string) => t(`auth.passwordStrength.requirements.${key}`);
  return [
    { label: v("minLength"), test: (pwd: string) => pwd.length >= 8 },
    { label: v("uppercase"), test: (pwd: string) => /[A-Z]/.test(pwd) },
    { label: v("lowercase"), test: (pwd: string) => /[a-z]/.test(pwd) },
    { label: v("number"), test: (pwd: string) => /[0-9]/.test(pwd) },
    {
      label: v("special"),
      test: (pwd: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
    },
  ];
}
