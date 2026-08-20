import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import CustomFormField, { FormFieldType } from "@/components/form/CustomFormField";
import { Mail, Phone, MapPin, Clock, MessageSquare, Users, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendContactConfirmationEmail, sendContactSubmissionEmail } from "@/lib/email";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { LEGAL_CONTACT } from "@/components/legal/legalContact";
import TurnstileWidget from "@/components/TurnstileWidget";
import { useTurnstile } from "@/hooks/useTurnstile";
import {
  COUNTRIES,
  getCountryCode,
} from "@/components/application/form/countries";
import {
  CONTACT_SUBJECT_OPTIONS,
  createContactFormSchema,
  type ContactFormValues,
} from "@/lib/schemas/contactForm.schema";

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

const Contact = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { t, i18n } = useTranslation("common");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const captcha = useTurnstile();

  const contactFormSchema = useMemo(() => createContactFormSchema(t), [t]);
  const subjectOptions = useMemo(
    () =>
      CONTACT_SUBJECT_OPTIONS.map((value) => ({
        value,
        label: t(`contactPage.form.subject${value.charAt(0).toUpperCase()}${value.slice(1)}`),
      })),
    [t],
  );

  const form = useForm<ContactFormValues>({
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

  const selectedCountry = useWatch({ control: form.control, name: "country" });
  const phoneCountryCode = getCountryCode(selectedCountry) || "GH";

  const onSubmit = async (data: ContactFormValues) => {
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
            turnstileToken: captcha.token,
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
        form.reset();
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
                  <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <CustomFormField
                        control={form.control}
                        name="firstName"
                        fieldType={FormFieldType.INPUT}
                        label={t("contactPage.form.firstNameLabel")}
                        placeholder={t("contactPage.form.firstNamePlaceholder")}
                        required
                      />
                      <CustomFormField
                        control={form.control}
                        name="lastName"
                        fieldType={FormFieldType.INPUT}
                        label={t("contactPage.form.lastNameLabel")}
                        placeholder={t("contactPage.form.lastNamePlaceholder")}
                        required
                      />
                    </div>

                    <CustomFormField
                      control={form.control}
                      name="email"
                      fieldType={FormFieldType.EMAIL}
                      label={t("contactPage.form.emailLabel")}
                      placeholder={t("contactPage.form.emailPlaceholder")}
                      required
                    />

                    <CustomFormField
                      control={form.control}
                      name="country"
                      fieldType={FormFieldType.SELECT}
                      label={t("contactPage.form.countryLabel")}
                      placeholder={t("contactPage.form.countryPlaceholder")}
                      options={COUNTRIES}
                    />

                    <CustomFormField
                      key={phoneCountryCode}
                      control={form.control}
                      name="phone"
                      fieldType={FormFieldType.PHONE_INTERNATIONAL}
                      label={t("contactPage.form.phoneLabel")}
                      placeholder={t("contactPage.form.phonePlaceholder")}
                      country={phoneCountryCode}
                      defaultCountry={phoneCountryCode}
                    />

                    <CustomFormField
                      control={form.control}
                      name="subject"
                      fieldType={FormFieldType.SELECT}
                      label={t("contactPage.form.subjectLabel")}
                      placeholder={t("contactPage.form.subjectPlaceholder")}
                      options={subjectOptions}
                      required
                    />

                    <CustomFormField
                      control={form.control}
                      name="message"
                      fieldType={FormFieldType.TEXTAREA}
                      label={t("contactPage.form.messageLabel")}
                      placeholder={t("contactPage.form.messagePlaceholder")}
                      rows={5}
                      required
                    />

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
                  </Form>
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








