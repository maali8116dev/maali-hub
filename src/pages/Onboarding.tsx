import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import { isValidPhoneNumber } from "libphonenumber-js";
import CustomFormField, { FormFieldType } from "@/components/form/CustomFormField";
import { ImageUpload } from "@/components/ui/image-upload";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth, parseEdgeFunctionError } from "@/lib/invokeWithAuth";
import { useAuth } from "@/hooks/useAuth";
import { useMembership, useInvalidateMembership } from "@/hooks/useMembership";
import { useToast } from "@/hooks/use-toast";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");

const MEMBER_PRICE_LABEL = "$2 / month";

const AFRICAN_COUNTRIES = [
  "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cameroon", "Central African Republic", "Chad", "Comoros",
  "Congo", "Côte d'Ivoire", "Djibouti", "Egypt", "Equatorial Guinea",
  "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea",
  "Guinea-Bissau", "Kenya", "Lesotho", "Liberia", "Libya", "Madagascar",
  "Malawi", "Mali", "Mauritania", "Mauritius", "Morocco", "Mozambique",
  "Namibia", "Niger", "Nigeria", "Rwanda", "São Tomé and Príncipe",
  "Senegal", "Seychelles", "Sierra Leone", "Somalia", "South Africa",
  "South Sudan", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda",
  "Zambia", "Zimbabwe",
];

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

// ─── Schema ───────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  organisationName: z.string().optional(),
  sector: z.string().min(1, "Sector is required"),
  country: z.string().min(1, "Country is required"),
  cityRegion: z.string().min(1, "City / region is required"),
  phoneNumber: z.string().min(1, "Phone number is required").refine(
    (v) => { try { return isValidPhoneNumber(v); } catch { return false; } },
    { message: "Enter a valid international number (e.g. +234 800 000 0000)" }
  ),
  bio: z.string().optional(),
  avatarUrl: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = "profile" | "payment" | "done";

// ─── Progress stepper ────────────────────────────────────────────────────────

const STEP_LABELS: { id: Step; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "payment", label: "Payment" },
];

const Stepper = ({ step }: { step: Step }) => {
  const stepIndex = STEP_LABELS.findIndex((s) => s.id === step);
  return (
    <div className="flex items-center justify-center mb-10 gap-0">
      {STEP_LABELS.map((s, i) => (
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
          {i < STEP_LABELS.length - 1 && (
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
  form: ReturnType<typeof useForm<ProfileFormValues>>;
  onNext: (data: ProfileFormValues) => Promise<void>;
  sectors: string[];
  userId: string;
}) => {
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onNext)} className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Complete your profile</h2>
          <p className="text-muted-foreground mt-1">
            This builds your Maali profile — visible to partners and opportunity providers across the network.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Profile Picture <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <ImageUpload
            value={form.watch("avatarUrl") || undefined}
            onChange={(url) => form.setValue("avatarUrl", url || "")}
            onUpload={uploadImage}
            onDelete={handleImageDelete}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            placeholder="Upload Profile Picture"
            variant="avatar"
          />
          <p className="text-xs text-muted-foreground">JPG, PNG, WebP or GIF up to 5MB</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <CustomFormField
            control={form.control}
            name="firstName"
            fieldType={FormFieldType.INPUT}
            label="First Name"
            placeholder="Amara"
            required
          />
          <CustomFormField
            control={form.control}
            name="lastName"
            fieldType={FormFieldType.INPUT}
            label="Last Name"
            placeholder="Diallo"
            required
          />
        </div>

        <CustomFormField
          control={form.control}
          name="organisationName"
          fieldType={FormFieldType.INPUT}
          label="Company / Organisation / University (optional)"
          placeholder="e.g. Savanna Ventures, University of Accra, UNDP"
        />

        <div className="grid grid-cols-2 gap-4">
          <CustomFormField
            control={form.control}
            name="sector"
            fieldType={FormFieldType.SELECT}
            label="Sector / Field"
            placeholder={sectors.length ? "Select your field" : "Loading…"}
            required
            options={sectors.map((s) => ({ value: s, label: s }))}
          />
          <CustomFormField
            control={form.control}
            name="country"
            fieldType={FormFieldType.SELECT}
            label="Country"
            placeholder="Select country"
            required
            options={AFRICAN_COUNTRIES.map((c) => ({ value: c, label: c }))}
          />
        </div>

        <CustomFormField
          control={form.control}
          name="cityRegion"
          fieldType={FormFieldType.INPUT}
          label="City / Region"
          placeholder="e.g. Lagos, Nairobi, Greater Accra"
          required
        />

        <CustomFormField
          control={form.control}
          name="phoneNumber"
          fieldType={FormFieldType.PHONE_INTERNATIONAL}
          label="Phone Number"
          placeholder="+234 800 000 0000"
          required
        />

        <CustomFormField
          control={form.control}
          name="bio"
          fieldType={FormFieldType.TEXTAREA}
          label="Short Bio (optional)"
          placeholder="e.g. Software engineer looking for fellowships, entrepreneur in agri-tech, recent grad seeking internships in finance…"
          rows={3}
        />

        <Button
          type="submit"
          className="w-full"
          variant="hero"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
            : <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>}
        </Button>
      </form>
    </Form>
  );
};

// ─── Step 2: Stripe payment form ─────────────────────────────────────────────

const PaymentForm = ({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Payment failed");
      setProcessing(false);
      return;
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/onboarding?awaiting=1` },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed");
      setProcessing(false);
    } else if (paymentIntent?.status === "succeeded") {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Payment</h2>
        <p className="text-muted-foreground mt-1">
          Full Member — <span className="font-semibold text-foreground">{MEMBER_PRICE_LABEL}</span>. Cancel anytime.
        </p>
      </div>
      <div className="rounded-lg border border-border p-4 bg-card">
        <PaymentElement />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={processing}>Back</Button>
        <Button type="submit" variant="hero" className="flex-1" disabled={!stripe || processing}>
          {processing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</> : "Pay $2 & Join"}
        </Button>
      </div>
      <p className="text-xs text-center text-muted-foreground">
        Payments are processed securely by Stripe. MAALI never stores your card details.
      </p>
    </form>
  );
};

const StepPayment = ({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    invokeWithAuth<{ clientSecret?: string; error?: string }>("create-membership-payment")
      .then(({ data, error }) => {
        if (error || !data?.clientSecret) {
          const msg =
            data?.error || parseEdgeFunctionError(error) || error?.message || "Unknown error";
          setFetchError(`Could not initialise payment: ${msg}`);
        } else {
          setClientSecret(data.clientSecret);
        }
      });
  }, []);

  if (fetchError) return (
    <div className="space-y-4">
      <p className="text-destructive text-sm">{fetchError}</p>
      <Button variant="outline" onClick={onBack}>Go back</Button>
    </div>
  );

  if (!clientSecret) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm onSuccess={onSuccess} onBack={onBack} />
    </Elements>
  );
};

// ─── Main Onboarding page ─────────────────────────────────────────────────────

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const sectors = useSectors();
  const { isPaidMember, loading: membershipLoading } = useMembership();
  const invalidateMembership = useInvalidateMembership();

  const [step, setStep] = useState<Step>("profile");
  const [activating, setActivating] = useState(false);

  // Single form instance — survives step transitions (back from payment keeps values)
  const form = useForm<ProfileFormValues>({
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

  const saveProfileAndContinue = async (data: ProfileFormValues) => {
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
      toast({ title: "Error saving profile", description: error.message, variant: "destructive" });
      return;
    }
    setStep("payment");
  };

  // If they already have a paid membership, skip onboarding
  useEffect(() => {
    if (!membershipLoading && isPaidMember && step !== "done" && !activating) {
      navigate("/dashboard", { replace: true });
    }
  }, [membershipLoading, isPaidMember, step, navigate, activating]);

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
      title: "Payment received — activation pending",
      description:
        "Your payment went through but we haven't received Stripe's confirmation yet. Refresh in a minute, or contact support if this persists.",
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
            <h2 className="text-2xl font-bold mb-2">Activating your membership…</h2>
            <p className="text-muted-foreground">
              Payment received. We're confirming with Stripe — this usually takes just a few seconds.
            </p>
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
            <p className="text-muted-foreground">You need an account first.</p>
            <Button variant="hero" className="w-full" onClick={() => navigate("/auth")}>Create Account</Button>
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
            <h2 className="text-3xl font-bold mb-2">Welcome to Maali!</h2>
            <p className="text-muted-foreground">
              Your membership is active. You can now apply to funding opportunities, jobs, internships, fellowships and more.
            </p>
          </div>
          <Button variant="hero" className="w-full" onClick={() => navigate("/dashboard", { replace: true })}>
            Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">Maali Opportunity Hub</h1>
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
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Onboarding;
