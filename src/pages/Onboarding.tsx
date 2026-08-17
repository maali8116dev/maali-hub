import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import headerLogoFallback from "@/assets/logo.webp";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import CustomFormField, { FormFieldType } from "@/components/form/CustomFormField";
import { ImageUpload } from "@/components/ui/image-upload";
import { useImageUpload } from "@/hooks/useImageUpload";
import { seedDefaultBillingAddress } from "@/lib/seedBillingAddress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MembershipPaymentStep } from "@/components/membership/MembershipPaymentStep";
import {
  getDefaultPaystackCurrency,
  type PaymentProviderChoice,
} from "@/lib/paymentProvider";
import {
  useMembership,
  useInvalidateMembership,
  useSyncMembershipAfterOnboarding,
} from "@/hooks/useMembership";
import { useToast } from "@/hooks/use-toast";
import { createOnboardingProfileSchema, type OnboardingProfileFormValues } from "@/lib/schemas/onboardingForm.schema";
import { COUNTRIES, getCountryCode } from "@/components/application/form/countries";

const headerLogoPublic = "/images/logo.webp";

// ─── Sectors from DB ─────────────────────────────────────────────────────────

function useSectors() {
  const [sectors, setSectors] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from("sectors")
      .select("name")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .then(({ data }) => {
        if (data) setSectors(data.map((s) => s.name));
      });
  }, []);

  return sectors;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = "profile" | "payment" | "done";

// ─── Progress stepper ────────────────────────────────────────────────────────

const Stepper = ({ step }: { step: Step }) => {
  const { t } = useTranslation("common");
  const stepLabels: { id: Step; label: string }[] = [
    { id: "profile", label: t("onboarding.steps.profile") },
    { id: "payment", label: t("onboarding.steps.payment") },
  ];
  const stepIndex = stepLabels.findIndex((s) => s.id === step);
  return (
    <div className="flex items-center justify-center mb-10 gap-0">
      {stepLabels.map((s, i) => (
        <div key={s.id} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                i < stepIndex
                  ? "bg-primary border-primary text-primary-foreground"
                  : i === stepIndex
                  ? "border-primary text-primary bg-background"
                  : "border-border text-muted-foreground bg-background"
              }`}
            >
              {i < stepIndex ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-xs mt-1 ${i === stepIndex ? "text-primary font-medium" : "text-muted-foreground"}`}>
              {s.label}
            </span>
          </div>
          {i < stepLabels.length - 1 && (
            <div className={`h-0.5 w-16 mx-1 mb-4 transition-colors ${i < stepIndex ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Step 1: Profile ─────────────────────────────────────────────────────────

const StepProfile = ({
  form,
  onNext,
  sectors,
  userId,
}: {
  form: ReturnType<typeof useForm<OnboardingProfileFormValues>>;
  onNext: (data: OnboardingProfileFormValues) => Promise<void>;
  sectors: string[];
  userId: string;
}) => {
  const { t } = useTranslation("common");
  const { uploadImage, deleteImage, isUploading, uploadProgress } = useImageUpload({
    bucket: "user-avatars",
    folder: userId,
    maxSizeMB: 5,
  });

  const handleImageDelete = async (url: string) => {
    const deleted = await deleteImage(url);
    if (deleted) form.setValue("avatarUrl", "");
    return deleted;
  };

  const selectedCountry = useWatch({ control: form.control, name: "country" });
  const phoneCountryCode = getCountryCode(selectedCountry) || "GH";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onNext)} className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t("onboarding.profile.title")}</h2>
          <p className="text-muted-foreground mt-1">{t("onboarding.profile.description")}</p>
        </div>

        <div className="space-y-2">
          <Label>
            {t("onboarding.profile.avatarLabel")}{" "}
            <span className="text-muted-foreground font-normal">{t("onboarding.profile.optional")}</span>
          </Label>
          <ImageUpload
            value={form.watch("avatarUrl") || undefined}
            onChange={(url) => form.setValue("avatarUrl", url || "")}
            onUpload={uploadImage}
            onDelete={handleImageDelete}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            placeholder={t("onboarding.profile.avatarPlaceholder")}
            variant="avatar"
          />
          <p className="text-xs text-muted-foreground">{t("onboarding.profile.avatarHint")}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <CustomFormField
            control={form.control}
            name="firstName"
            fieldType={FormFieldType.INPUT}
            label={t("onboarding.profile.firstName")}
            placeholder={t("onboarding.profile.firstNamePlaceholder")}
            required
          />
          <CustomFormField
            control={form.control}
            name="lastName"
            fieldType={FormFieldType.INPUT}
            label={t("onboarding.profile.lastName")}
            placeholder={t("onboarding.profile.lastNamePlaceholder")}
            required
          />
        </div>

        <CustomFormField
          control={form.control}
          name="organisationName"
          fieldType={FormFieldType.INPUT}
          label={t("onboarding.profile.organisation")}
          placeholder={t("onboarding.profile.organisationPlaceholder")}
        />

        <div className="grid grid-cols-2 gap-4">
          <CustomFormField
            control={form.control}
            name="sector"
            fieldType={FormFieldType.SELECT}
            label={t("onboarding.profile.sector")}
            placeholder={sectors.length ? t("onboarding.profile.sectorPlaceholder") : t("onboarding.profile.sectorLoading")}
            required
            options={sectors.map((s) => ({ value: s, label: s }))}
          />
          <CustomFormField
            control={form.control}
            name="country"
            fieldType={FormFieldType.SELECT}
            label={t("onboarding.profile.country")}
            placeholder={t("onboarding.profile.countryPlaceholder")}
            required
            options={COUNTRIES}
          />
        </div>

        <CustomFormField
          control={form.control}
          name="cityRegion"
          fieldType={FormFieldType.INPUT}
          label={t("onboarding.profile.cityRegion")}
          placeholder={t("onboarding.profile.cityRegionPlaceholder")}
          required
        />

        <CustomFormField
          key={phoneCountryCode}
          control={form.control}
          name="phoneNumber"
          fieldType={FormFieldType.PHONE_INTERNATIONAL}
          label={t("onboarding.profile.phone")}
          placeholder={t("onboarding.profile.phonePlaceholder")}
          country={phoneCountryCode}
          defaultCountry={phoneCountryCode}
          required
        />

        <CustomFormField
          control={form.control}
          name="bio"
          fieldType={FormFieldType.TEXTAREA}
          label={t("onboarding.profile.bio")}
          placeholder={t("onboarding.profile.bioPlaceholder")}
          rows={3}
        />

        <Button
          type="submit"
          className="w-full"
          variant="hero"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("onboarding.profile.saving")}</>
            : <>{t("onboarding.profile.continue")} <ArrowRight className="ml-2 h-4 w-4" /></>}
        </Button>
      </form>
    </Form>
  );
};

// ─── Step 2: Membership payment ──────────────────────────────────────────────

type PaymentReceiptDetails = {
  billingEmail: string;
  country: string;
  cityRegion: string;
  fullName: string;
  companyName?: string;
};

const StepPayment = ({
  onSuccess,
  onBack,
  onSkip,
  receiptDetails,
  userId,
}: {
  onSuccess: () => void;
  onBack: () => void;
  onSkip: () => void;
  receiptDetails: PaymentReceiptDetails;
  userId: string;
}) => {
  const { t } = useTranslation("common");
  const [billingEmail, setBillingEmail] = useState(receiptDetails.billingEmail);
  const [choice, setChoice] = useState<PaymentProviderChoice>({
    provider: "stripe",
    currency: getDefaultPaystackCurrency(receiptDetails.country),
  });

  const handleSuccess = async () => {
    await seedDefaultBillingAddress({
      userId,
      billingEmail,
      country: receiptDetails.country,
      city: receiptDetails.cityRegion,
      fullName: receiptDetails.fullName,
      companyName: receiptDetails.companyName,
    });
    onSuccess();
  };

  return (
    <div className="space-y-4">
      <MembershipPaymentStep
        userId={userId}
        billingEmail={billingEmail}
        onBillingEmailChange={setBillingEmail}
        choice={choice}
        onChoiceChange={setChoice}
        onSuccess={handleSuccess}
        onBack={onBack}
        defaultPaystackCurrency={getDefaultPaystackCurrency(receiptDetails.country)}
        title={t("onboarding.payment.title")}
        description={t("onboarding.payment.description", { price: t("onboarding.memberPriceLabel") })}
      />
      <div className="text-center">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline hover:text-foreground transition-colors"
        >
          {t("onboarding.payment.skipToCommunity")}
        </button>
      </div>
    </div>
  );
};

// ─── Main Onboarding page ─────────────────────────────────────────────────────

const Onboarding = () => {
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const sectors = useSectors();
  const { membership, isActiveMember, isPaidMember, loading: membershipLoading } = useMembership();
  const invalidateMembership = useInvalidateMembership();
  const syncMembership = useSyncMembershipAfterOnboarding();

  const [step, setStep] = useState<Step>("profile");
  const [activating, setActivating] = useState(false);

  // Single form instance — survives step transitions (back from payment keeps values)
  const profileSchema = useMemo(() => createOnboardingProfileSchema(t), [t]);

  const form = useForm<OnboardingProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.user_metadata?.first_name ?? (user?.user_metadata?.full_name as string ?? "").split(" ")[0] ?? "",
      lastName: user?.user_metadata?.last_name ?? (user?.user_metadata?.full_name as string ?? "").split(" ").slice(1).join(" ") ?? "",
      organisationName: "",
      sector: "",
      country: "",
      cityRegion: "",
      phoneNumber: "",
      bio: "",
      avatarUrl: "",
    },
  });

  // Pre-fill name if auth metadata arrives after mount (e.g. OAuth)
  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata ?? {};
    const fullName = (meta.full_name as string) ?? (meta.name as string) ?? "";
    const current = form.getValues();
    if (!current.firstName) form.setValue("firstName", (meta.first_name as string) || fullName.split(" ")[0] || "");
    if (!current.lastName) form.setValue("lastName", (meta.last_name as string) || fullName.split(" ").slice(1).join(" ") || "");
  }, [user?.id]);

  const saveProfileAndContinue = async (data: OnboardingProfileFormValues) => {
    if (!user) return;
    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: user.id,
        first_name: data.firstName,
        last_name: data.lastName,
        business_name: data.organisationName || null,
        business_sector: data.sector,
        country: data.country,
        city_region: data.cityRegion,
        phone_number: data.phoneNumber,
        bio: data.bio || null,
        avatar_url: data.avatarUrl || null,
      },
      { onConflict: "user_id" }
    );
    if (error) {
      toast({ title: t("onboarding.toasts.profileSaveError.title"), description: error.message, variant: "destructive" });
      return;
    }
    setStep("payment");
  };

  const skipToFreePlan = async () => {
    if (!user) return;

    const { data: existing, error: fetchError } = await supabase
      .from("memberships")
      .select("id, status, tier")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      toast({ title: t("onboarding.toasts.error.title"), description: fetchError.message, variant: "destructive" });
      return;
    }

    if (existing?.status === "active" && existing.tier === "member") {
      await syncMembership();
      navigate("/dashboard", { replace: true });
      return;
    }

    if (existing?.status === "active" && existing.tier === "community") {
      await syncMembership();
      navigate("/dashboard", { replace: true });
      return;
    }

    const communityActive = {
      tier: "community" as const,
      status: "active" as const,
      stripe_customer_id: null,
      stripe_payment_intent_id: null,
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    };

    const { error } = existing
      ? await supabase.from("memberships").update(communityActive).eq("id", existing.id)
      : await supabase.from("memberships").insert({
          user_id: user.id,
          tier: "community",
          status: "active",
          starts_at: new Date().toISOString(),
        });

    if (error) {
      toast({ title: t("onboarding.toasts.error.title"), description: error.message, variant: "destructive" });
      return;
    }

    await syncMembership();
    navigate("/dashboard", { replace: true });
  };

  // Poll for webhook activation after Stripe payment
  const waitForActivation = async () => {
    if (!user) return;
    setActivating(true);
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      invalidateMembership();
      const { data } = await supabase
        .from("memberships")
        .select("status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (data) {
        setActivating(false);
        setStep("done");
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setActivating(false);
    toast({
      title: t("onboarding.toasts.activationPending.title"),
      description: t("onboarding.toasts.activationPending.description"),
    });
  };

  // Handle return from Stripe redirect (/onboarding?awaiting=1)
  useEffect(() => {
    if (searchParams.get("awaiting") === "1" && user && !activating) {
      searchParams.delete("awaiting");
      setSearchParams(searchParams, { replace: true });
      waitForActivation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, searchParams]);

  const shouldLeaveOnboarding =
    !membershipLoading &&
    !activating &&
    step !== "done" &&
    (isPaidMember || (isActiveMember && membership?.tier === "community"));

  if (shouldLeaveOnboarding) {
    return <Navigate to="/dashboard" replace />;
  }

  if (membershipLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (activating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <div>
            <h2 className="text-2xl font-bold mb-2">{t("onboarding.activating.title")}</h2>
            <p className="text-muted-foreground">{t("onboarding.activating.description")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-muted-foreground">{t("onboarding.noAccount.message")}</p>
            <Button variant="hero" className="w-full" onClick={() => navigate("/auth")}>{t("onboarding.noAccount.cta")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <Check className="h-8 w-8 text-success" />
          </div>
          <div>
            <h2 className="text-3xl font-bold mb-2">{t("onboarding.done.title")}</h2>
            <p className="text-muted-foreground">{t("onboarding.done.description")}</p>
          </div>
          <Button variant="hero" className="w-full" onClick={() => navigate("/dashboard", { replace: true })}>
            {t("onboarding.done.goToDashboard")} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <Link to="/">
          <img
            src={headerLogoPublic}
            alt={t("onboarding.logoAlt")}
            className="h-8 w-auto"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = headerLogoFallback;
            }}
          />
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <Stepper step={step} />

        <Card className="shadow-elegant">
          <CardContent className="p-6 sm:p-8">
            {step === "profile" && (
              <StepProfile form={form} onNext={saveProfileAndContinue} sectors={sectors} userId={user.id} />
            )}
            {step === "payment" && (
              <StepPayment
                onSuccess={waitForActivation}
                onBack={() => setStep("profile")}
                onSkip={skipToFreePlan}
                userId={user.id}
                receiptDetails={{
                  billingEmail: user.email ?? "",
                  country: form.getValues("country"),
                  cityRegion: form.getValues("cityRegion"),
                  fullName: `${form.getValues("firstName")} ${form.getValues("lastName")}`.trim(),
                  companyName: form.getValues("organisationName"),
                }}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Onboarding;
