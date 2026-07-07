import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate, Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Phone, MapPin, Clock, MessageSquare, Users, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendContactConfirmationEmail, sendContactSubmissionEmail } from "@/lib/email";
import { useAuth } from "@/hooks/useAuth";
import { emailSchema } from "@/lib/emailValidation";
import { useTranslation } from "react-i18next";
import { LEGAL_CONTACT } from "@/components/legal/legalContact";
import TurnstileWidget from "@/components/TurnstileWidget";
import { useTurnstile } from "@/hooks/useTurnstile";

const SUBJECT_OPTIONS = ["funding", "application", "partnership", "technical", "general"] as const;

/** Reads the `code` field from a Supabase Edge Function error response body, if any. */
async function readEdgeErrorCode(err: unknown): Promise<string | null> {
  const ctx = (err as { context?: Response } | null)?.context;
  if (!ctx || typeof ctx.clone !== "function") return null;
  try {
    const body = await ctx.clone().json();
    return body?.code ?? body?.errorCode ?? null;
  } catch {
    return null;
  }
}

type ContactFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  country?: string;
  subject: (typeof SUBJECT_OPTIONS)[number];
  message: string;
};

const Contact = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { t, i18n } = useTranslation("common");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const captcha = useTurnstile();

  const contactFormSchema = useMemo(
    () =>
      z.object({
        firstName: z.string().min(1, t("contactPage.validation.firstNameRequired")).max(100, t("contactPage.validation.firstNameTooLong")),
        lastName: z.string().min(1, t("contactPage.validation.lastNameRequired")).max(100, t("contactPage.validation.lastNameTooLong")),
        email: emailSchema,
        phone: z.string().optional(),
        country: z.string().optional(),
        subject: z.enum(SUBJECT_OPTIONS, {
          required_error: t("contactPage.validation.subjectRequired"),
        }),
        message: z
          .string()
          .min(10, t("contactPage.validation.messageMin"))
          .max(5000, t("contactPage.validation.messageTooLong")),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      country: "",
      subject: undefined,
      message: "",
    },
  });

  const selectedSubject = watch("subject");
  const selectedCountry = watch("country");

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    setSubmitSuccess(false);

    try {
      // Submit via Edge Function (verifies Turnstile token server-side before inserting)
      const { data: result, error: submitError } = await supabase.functions.invoke(
        "submit-contact",
        {
          body: {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone || null,
            country: data.country || null,
            subject: data.subject,
            message: data.message,
            token: session?.access_token,
            turnstileToken,
          },
        },
      );

      if (submitError || !result?.data?.id) {
        console.error("Contact submission error:", submitError);
        const code = await readEdgeErrorCode(submitError);
        toast.error(
          code === "CAPTCHA_FAILED"
            ? t("contactPage.toasts.captchaFailed")
            : t("contactPage.toasts.submitFailed"),
        );
        return;
      }

      const submissionId = result.data.id as string;

      // Send confirmation email to user
      const emailLocale = i18n.language?.split("-")[0];
      const confirmationResult = await sendContactConfirmationEmail(
        data.email,
        data.firstName,
        data.message,
        submissionId,
        emailLocale,
      );

      if (!confirmationResult.success) {
        console.error("Failed to send confirmation email:", confirmationResult.error);
        // Don't fail the submission if email fails
      }

      // Send notification email to admin
      const adminEmail = LEGAL_CONTACT.email;
      const adminResult = await sendContactSubmissionEmail(
        adminEmail,
        data.firstName,
        data.lastName,
        data.email,
        data.phone || null,
        data.country || null,
        data.subject,
        data.message,
        submissionId,
        emailLocale,
      );

      if (!adminResult.success) {
        console.error("Failed to send admin notification:", adminResult.error);
        // Don't fail the submission if email fails
      }

      setSubmitSuccess(true);
      toast.success(t("contactPage.toasts.submitSuccess"));

      // Reset form after 3 seconds
      setTimeout(() => {
        setSubmitSuccess(false);
        // Reset form
        setValue("firstName", "");
        setValue("lastName", "");
        setValue("email", "");
        setValue("phone", "");
        setValue("country", "");
        setValue("subject", undefined);
        setValue("message", "");
      }, 3000);
    } catch (error) {
      console.error("Submission error:", error);
      toast.error(t("contactPage.toasts.unexpectedError"));
    } finally {
      setIsSubmitting(false);
      // Single-use token: reset after every attempt so the widget re-issues one.
      captcha.reset();
    }
  };

  const contactInfo = [
    {
      icon: Mail,
      title: t("contactPage.contactInfo.emailTitle"),
      content: LEGAL_CONTACT.email,
      description: t("contactPage.contactInfo.emailDescription"),
    },
    {
      icon: Phone,
      title: t("contactPage.contactInfo.callTitle"),
      content: LEGAL_CONTACT.phone,
      description: t("contactPage.contactInfo.callDescription"),
    },
    {
      icon: MapPin,
      title: t("contactPage.contactInfo.officeTitle"),
      content: LEGAL_CONTACT.addressDisplay,
      description: t("contactPage.contactInfo.officeDescription"),
    },
    {
      icon: Clock,
      title: t("contactPage.contactInfo.responseTimeTitle"),
      content: t("contactPage.contactInfo.responseTimeValue"),
      description: t("contactPage.contactInfo.responseTimeDescription"),
    },
  ];

  // Legal notice lists one registered address only — no regional office directory yet.
  // const officeLocations = useMemo(
  //   () =>
  //     t("contactPage.officeLocations.offices", { returnObjects: true }) as Array<{
  //       city: string;
  //       country: string;
  //       address: string;
  //       role: string;
  //     }>,
  //   [t],
  // );

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            {t("contactPage.hero.title")}
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            {t("contactPage.hero.subtitle")}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-12">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  {t("contactPage.form.title")}
                </CardTitle>
                <CardDescription>
                  {t("contactPage.form.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {submitSuccess ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle2 className="h-16 w-16 text-success mb-4" />
                    <h3 className="text-xl font-semibold mb-2">
                      {t("contactPage.success.title")}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {t("contactPage.success.description")}
                    </p>
                    <Button onClick={() => setSubmitSuccess(false)} variant="outline">
                      {t("contactPage.success.sendAnother")}
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">{t("contactPage.form.firstNameLabel")}</Label>
                        <Input
                          id="firstName"
                          placeholder={t("contactPage.form.firstNamePlaceholder")}
                          className="h-12 sm:h-10"
                          {...register("firstName")}
                        />
                        {errors.firstName && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {errors.firstName.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">{t("contactPage.form.lastNameLabel")}</Label>
                        <Input
                          id="lastName"
                          placeholder={t("contactPage.form.lastNamePlaceholder")}
                          className="h-12 sm:h-10"
                          {...register("lastName")}
                        />
                        {errors.lastName && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {errors.lastName.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">{t("contactPage.form.emailLabel")}</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder={t("contactPage.form.emailPlaceholder")}
                        className="h-12 sm:h-10"
                        {...register("email")}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">{t("contactPage.form.phoneLabel")}</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder={t("contactPage.form.phonePlaceholder")}
                        className="h-12 sm:h-10"
                        {...register("phone")}
                      />
                      {errors.phone && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.phone.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="country">{t("contactPage.form.countryLabel")}</Label>
                      <Select
                        value={selectedCountry}
                        onValueChange={(value) => setValue("country", value)}
                      >
                        <SelectTrigger className="h-12 sm:h-10">
                          <SelectValue placeholder={t("contactPage.form.countryPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nigeria">{t("contactPage.form.countryNigeria")}</SelectItem>
                          <SelectItem value="kenya">{t("contactPage.form.countryKenya")}</SelectItem>
                          <SelectItem value="south-africa">{t("contactPage.form.countrySouthAfrica")}</SelectItem>
                          <SelectItem value="ghana">{t("contactPage.form.countryGhana")}</SelectItem>
                          <SelectItem value="uganda">{t("contactPage.form.countryUganda")}</SelectItem>
                          <SelectItem value="tanzania">{t("contactPage.form.countryTanzania")}</SelectItem>
                          <SelectItem value="other">{t("contactPage.form.countryOther")}</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.country && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.country.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject">{t("contactPage.form.subjectLabel")}</Label>
                      <Select
                        value={selectedSubject}
                        onValueChange={(value) => setValue("subject", value as ContactFormData["subject"])}
                      >
                        <SelectTrigger className="h-12 sm:h-10">
                          <SelectValue placeholder={t("contactPage.form.subjectPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="funding">{t("contactPage.form.subjectFunding")}</SelectItem>
                          <SelectItem value="application">{t("contactPage.form.subjectApplication")}</SelectItem>
                          <SelectItem value="partnership">{t("contactPage.form.subjectPartnership")}</SelectItem>
                          <SelectItem value="technical">{t("contactPage.form.subjectTechnical")}</SelectItem>
                          <SelectItem value="general">{t("contactPage.form.subjectGeneral")}</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.subject && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.subject.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">{t("contactPage.form.messageLabel")}</Label>
                      <Textarea
                        id="message"
                        placeholder={t("contactPage.form.messagePlaceholder")}
                        className="min-h-[120px]"
                        {...register("message")}
                      />
                      {errors.message && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.message.message}
                        </p>
                      )}
                    </div>

                    <TurnstileWidget {...captcha.widgetProps} className="flex justify-center" />

                    <Button
                      type="submit"
                      className="w-full min-h-[48px]"
                      variant="hero"
                      size="lg"
                      disabled={isSubmitting || captcha.blocked}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("contactPage.form.sending")}
                        </>
                      ) : (
                        t("contactPage.form.submit")
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Contact Information */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  {t("contactPage.contactInfo.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {contactInfo.map((info, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <info.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{info.title}</h4>
                      <p className="font-semibold text-sm">{info.content}</p>
                      <p className="text-xs text-muted-foreground">{info.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Office locations hidden — legal notice has registered address only (see LEGAL_CONTACT). */}
            {/* <Card>
              <CardHeader>
                <CardTitle>{t("contactPage.officeLocations.title")}</CardTitle>
                <CardDescription>
                  {t("contactPage.officeLocations.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {officeLocations.map((office, index) => (
                  <div key={index} className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold text-foreground">{office.city}, {office.country}</h4>
                    <p className="text-sm text-muted-foreground">{office.address}</p>
                    <p className="text-xs text-primary font-medium mt-1">{office.role}</p>
                  </div>
                ))}
              </CardContent>
            </Card> */}

            <Card className="bg-gradient-primary text-white">
              <CardContent className="p-6 text-center">
                <h3 className="font-bold text-lg mb-2">{t("contactPage.quickSupport.title")}</h3>
                <p className="text-sm opacity-90 mb-4">
                  {t("contactPage.quickSupport.description")}
                </p>
                <div className="space-y-2">
                  <Button variant="secondary" size="sm" className="w-full" asChild>
                    <Link to="/faq">{t("contactPage.quickSupport.viewFaq")}</Link>
                  </Button>
                  <Button variant="outline" size="sm" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20">
                    {t("contactPage.quickSupport.scheduleCall")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center bg-gradient-subtle rounded-2xl p-8 md:p-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            {t("contactPage.cta.title")}
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            {t("contactPage.cta.description")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="lg" asChild>
              <Link to="/opportunities">{t("contactPage.cta.browseOpportunities")}</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/auth">{t("contactPage.cta.createAccount")}</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Contact;








