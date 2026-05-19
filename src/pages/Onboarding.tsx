import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Users, Zap, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = "profile" | "tier" | "payment" | "done";

interface ProfileData {
  firstName: string;
  lastName: string;
  organisationName: string;
  sector: string;
  country: string;
  bio: string;
}

// ─── Progress stepper ────────────────────────────────────────────────────────

const STEP_LABELS: { id: Step; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "tier", label: "Membership" },
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
  initial,
  onNext,
  sectors,
}: {
  initial: ProfileData;
  onNext: (data: ProfileData) => void;
  sectors: string[];
}) => {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  // Re-sync if initial values arrive late (e.g. from auth metadata)
  useEffect(() => { setForm(initial); }, [initial.firstName, initial.lastName]);

  const set =
    (k: keyof ProfileData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid = form.firstName && form.lastName && form.sector && form.country;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Complete your profile</h2>
        <p className="text-muted-foreground mt-1">
          This builds your MAALI profile — visible to partners and opportunity providers across the network.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input id="firstName" value={form.firstName} onChange={set("firstName")} placeholder="Amara" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input id="lastName" value={form.lastName} onChange={set("lastName")} placeholder="Diallo" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="organisationName">Company / Organisation / University <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input id="organisationName" value={form.organisationName} onChange={set("organisationName")} placeholder="e.g. Savanna Ventures, University of Accra, UNDP" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sector">Sector / Field *</Label>
          <Select value={form.sector} onValueChange={(v) => setForm((f) => ({ ...f, sector: v }))}>
            <SelectTrigger id="sector">
              <SelectValue placeholder={sectors.length ? "Select your field" : "Loading…"} />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country *</Label>
          <Select value={form.country} onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}>
            <SelectTrigger id="country">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {AFRICAN_COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Short Bio <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Textarea
          id="bio"
          value={form.bio}
          onChange={set("bio")}
          placeholder="e.g. Software engineer looking for fellowships, entrepreneur in agri-tech, recent grad seeking internships in finance…"
          rows={3}
        />
      </div>

      <Button
        className="w-full"
        variant="hero"
        disabled={!valid || saving}
        onClick={() => { setSaving(true); onNext(form); }}
      >
        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>}
      </Button>
    </div>
  );
};

// ─── Step 2: Tier selection ───────────────────────────────────────────────────

const TIERS = [
  {
    id: "community" as const,
    name: "Community",
    price: "Free",
    badge: null,
    icon: <Users className="h-5 w-5 text-muted-foreground" />,
    description: "Browse the full range of opportunities across Africa.",
    features: [
      "Browse funding, jobs, internships & fellowships",
      "Access public resources & guides",
      "Join the MAALI community network",
      "Monthly opportunities newsletter",
    ],
    cta: "Join Free",
    variant: "outline" as const,
  },
  {
    id: "member" as const,
    name: "Full Member",
    price: MEMBER_PRICE_LABEL,
    badge: "Most Popular",
    icon: <Zap className="h-5 w-5 text-primary" />,
    description: "Apply to opportunities — funding, jobs, internships, fellowships and more.",
    features: [
      "Everything in Community",
      "Apply to all opportunity types",
      "Priority application review",
      "Direct messaging with reviewers & partners",
      "Featured profile in network",
      "Exclusive member events & workshops",
    ],
    cta: "Become a Member",
    variant: "hero" as const,
  },
];

const StepTier = ({
  onNext,
  loading,
}: {
  onNext: (tier: "community" | "member") => void;
  loading: boolean;
}) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold text-foreground">Choose your membership</h2>
      <p className="text-muted-foreground mt-1">
        Whether you're an entrepreneur, professional, student, or researcher — MAALI has opportunities for you. Upgrade anytime.
      </p>
    </div>
    <div className="grid gap-6 md:grid-cols-2">
      {TIERS.map((tier) => (
        <Card
          key={tier.id}
          className="relative flex flex-col border-2 hover:border-primary hover:shadow-elegant transition-all duration-200 cursor-pointer"
          onClick={() => !loading && onNext(tier.id)}
        >
          {tier.badge && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground px-3">{tier.badge}</Badge>
            </div>
          )}
          <CardContent className="flex flex-col h-full p-6 pt-8">
            <div className="flex items-center gap-2 mb-1">
              {tier.icon}
              <span className="font-semibold text-foreground">{tier.name}</span>
            </div>
            <div className="text-3xl font-bold text-foreground mb-1">{tier.price}</div>
            <p className="text-sm text-muted-foreground mb-5">{tier.description}</p>
            <ul className="space-y-2 mb-6 flex-1">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button variant={tier.variant} className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : tier.cta}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

// ─── Step 3: Stripe payment form ─────────────────────────────────────────────

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
      // Membership activated by webhook — just advance UI
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
    supabase.functions
      .invoke("create-membership-payment", { body: {} })
      .then(({ data, error }) => {
        if (error || !data?.clientSecret) {
          const msg = data?.error || error?.message || "Unknown error";
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
  const { membership, loading: membershipLoading } = useMembership();
  const invalidateMembership = useInvalidateMembership();

  const [step, setStep] = useState<Step>("profile");
  const [selectedTier, setSelectedTier] = useState<"community" | "member" | null>(null);
  const [tierLoading, setTierLoading] = useState(false);
  const [activating, setActivating] = useState(false);

  // Pre-fill from auth metadata (works for both email signup and Google OAuth)
  const [profile, setProfile] = useState<ProfileData>({
    firstName: user?.user_metadata?.first_name ?? (user?.user_metadata?.full_name as string ?? "").split(" ")[0] ?? "",
    lastName: user?.user_metadata?.last_name ?? (user?.user_metadata?.full_name as string ?? "").split(" ").slice(1).join(" ") ?? "",
    organisationName: "",
    sector: "",
    country: "",
    bio: "",
  });

  // Update pre-fill if user loads after mount (OAuth)
  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata ?? {};
    const fullName = (meta.full_name as string) ?? (meta.name as string) ?? "";
    setProfile((p) => ({
      ...p,
      firstName: p.firstName || (meta.first_name as string) || fullName.split(" ")[0] || "",
      lastName: p.lastName || (meta.last_name as string) || fullName.split(" ").slice(1).join(" ") || "",
    }));
  }, [user?.id]);

  const saveProfileAndContinue = async (data: ProfileData) => {
    setProfile(data);
    if (user) {
      const { error } = await supabase.from("profiles").upsert(
        {
          user_id: user.id,
          first_name: data.firstName,
          last_name: data.lastName,
          business_name: data.organisationName || null,
          business_sector: data.sector,
          country: data.country,
          bio: data.bio || null,
        },
        { onConflict: "user_id" }
      );
      if (error) {
        toast({ title: "Error saving profile", description: error.message, variant: "destructive" });
        return;
      }
    }
    setStep("tier");
  };

  const handleTierSelect = async (tier: "community" | "member") => {
    setSelectedTier(tier);
    setTierLoading(true);

    if (tier === "community") {
      if (user) {
        const { error } = await supabase.from("memberships").insert({
          user_id: user.id,
          tier: "community",
          status: "active",
          starts_at: new Date().toISOString(),
        });
        if (error && error.code !== "23505") {
          // 23505 = unique violation (already has membership) — treat as success
          toast({ title: "Error", description: error.message, variant: "destructive" });
          setTierLoading(false);
          return;
        }
      }
      // Invalidate so ProtectedRoute picks up the new membership immediately
      invalidateMembership();
      setStep("done");
    } else {
      setTierLoading(false);
      setStep("payment");
    }
  };

  // If they already have an active membership, skip onboarding
  useEffect(() => {
    if (!membershipLoading && membership && step !== "done" && !activating) {
      navigate("/dashboard", { replace: true });
    }
  }, [membershipLoading, membership, step, navigate, activating]);

  // After Stripe confirms payment, the webhook may take a few seconds to flip
  // the membership row from 'pending_payment' to 'active'. Poll briefly so the
  // user isn't stuck looking at the form while activation lands.
  const waitForActivation = async () => {
    if (!user) return;
    setActivating(true);
    const deadline = Date.now() + 20_000; // 20s budget
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

  // Handle return from Stripe redirect (e.g. /payment/success -> /onboarding?awaiting=1)
  useEffect(() => {
    if (searchParams.get("awaiting") === "1" && user && !activating) {
      setSelectedTier("member");
      // Strip the query param so refresh doesn't re-trigger
      searchParams.delete("awaiting");
      setSearchParams(searchParams, { replace: true });
      waitForActivation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, searchParams]);

  // Wait for membership check before rendering anything — prevents step 1 flash
  if (membershipLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // Activation overlay — payment succeeded, waiting for webhook
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

  // If not logged in, send to auth
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

  // Done screen
  if (step === "done") {
    const isPaid = selectedTier === "member";
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <Check className="h-8 w-8 text-success" />
          </div>
          <div>
            <h2 className="text-3xl font-bold mb-2">Welcome to MAALI!</h2>
            <p className="text-muted-foreground">
              {isPaid
                ? "Your Full Membership is active. You can now apply to funding opportunities, jobs, internships, fellowships and more."
                : "You've joined the MAALI community. Upgrade to Full Member anytime to start applying for opportunities."}
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
      {/* Minimal header — no full nav during onboarding */}
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">Maali</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <Stepper step={step} />

        <Card className="shadow-elegant">
          <CardContent className="p-6 sm:p-8">
            {step === "profile" && (
              <StepProfile initial={profile} onNext={saveProfileAndContinue} sectors={sectors} />
            )}
            {step === "tier" && (
              <StepTier onNext={handleTierSelect} loading={tierLoading} />
            )}
            {step === "payment" && (
              <StepPayment
                onSuccess={() => {
                  // Don't trust the local UI — wait for the webhook to flip
                  // the membership to 'active' before declaring success.
                  waitForActivation();
                }}
                onBack={() => setStep("tier")}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Onboarding;
