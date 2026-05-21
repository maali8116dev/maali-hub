import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Users, Zap, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth, parseEdgeFunctionError } from "@/lib/invokeWithAuth";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "");

// Price is authoritative in the edge function — these are display-only constants
const MEMBER_PRICE_LABEL = "$2 / month";

const SECTORS = [
  "Agriculture", "Education", "Energy", "FinTech", "Health",
  "Logistics", "Manufacturing", "Retail", "Technology", "Other",
];

const TIERS = [
  {
    id: "community" as const,
    name: "Community",
    price: "Free",
    badge: null,
    description: "Join the MAALI network and browse opportunities.",
    features: [
      "Browse all funding opportunities",
      "Access public resources",
      "Join the community network",
      "Monthly newsletter",
    ],
    cta: "Join Free",
  },
  {
    id: "member" as const,
    name: "Full Member",
    price: "$2 / month",
    badge: "Most Popular",
    description: "Unlock the full MAALI platform and apply to opportunities.",
    features: [
      "Everything in Community",
      "Apply to funding opportunities",
      "Priority application review",
      "Direct messaging with reviewers",
      "Featured profile in network",
      "Exclusive member events",
    ],
    cta: "Become a Member",
  },
];

// ─── Step 1: Profile ────────────────────────────────────────────────────────

interface ProfileData {
  firstName: string;
  lastName: string;
  businessName: string;
  businessSector: string;
  country: string;
  bio: string;
}

const StepProfile = ({
  initial,
  onNext,
}: {
  initial: ProfileData;
  onNext: (data: ProfileData) => void;
}) => {
  const [form, setForm] = useState(initial);

  const set = (k: keyof ProfileData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid =
    form.firstName && form.lastName && form.businessName && form.businessSector && form.country;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Tell us about yourself</h2>
        <p className="text-muted-foreground mt-1">
          This builds your MAALI member profile visible to the network.
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
        <Label htmlFor="businessName">Business / Organisation Name *</Label>
        <Input id="businessName" value={form.businessName} onChange={set("businessName")} placeholder="Savanna Ventures" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="businessSector">Sector *</Label>
          <select
            id="businessSector"
            value={form.businessSector}
            onChange={set("businessSector")}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="">Select sector</option>
            {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country *</Label>
          <Input id="country" value={form.country} onChange={set("country")} placeholder="Kenya" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Short Bio</Label>
        <Textarea
          id="bio"
          value={form.bio}
          onChange={set("bio")}
          placeholder="Tell the MAALI network what you're building…"
          rows={3}
        />
      </div>

      <Button
        className="w-full"
        variant="hero"
        disabled={!valid}
        onClick={() => onNext(form)}
      >
        Continue <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
};

// ─── Step 2: Tier selection ──────────────────────────────────────────────────

const StepTier = ({
  onNext,
}: {
  onNext: (tier: "community" | "member") => void;
}) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold text-foreground">Choose your membership</h2>
      <p className="text-muted-foreground mt-1">You can upgrade at any time.</p>
    </div>

    <div className="grid gap-6 md:grid-cols-2">
      {TIERS.map((tier) => (
        <Card
          key={tier.id}
          className="relative flex flex-col hover:shadow-elegant transition-all duration-300 cursor-pointer border-2 hover:border-primary"
          onClick={() => onNext(tier.id)}
        >
          {tier.badge && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground px-3">{tier.badge}</Badge>
            </div>
          )}
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 mb-1">
              {tier.id === "community" ? (
                <Users className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Zap className="h-5 w-5 text-primary" />
              )}
              <CardTitle className="text-lg">{tier.name}</CardTitle>
            </div>
            <div className="text-3xl font-bold text-foreground">{tier.price}</div>
            <CardDescription>{tier.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            <ul className="space-y-2">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className="w-full mt-4"
              variant={tier.id === "member" ? "hero" : "outline"}
            >
              {tier.cta}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

// ─── Step 3: Payment form (inside Elements context) ──────────────────────────

const PaymentForm = ({
  onSuccess,
  onBack,
}: {
  onSuccess: () => void;
  onBack: () => void;
}) => {
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
      confirmParams: { return_url: `${window.location.origin}/join/success` },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed");
      setProcessing(false);
    } else if (paymentIntent?.status === "succeeded") {
      // Membership activation is handled server-side by the Stripe webhook.
      // Just advance the UI — the webhook will flip the membership to active.
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

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={processing}>
          Back
        </Button>
        <Button type="submit" variant="hero" className="flex-1" disabled={!stripe || processing}>
          {processing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
          ) : (
            "Pay $2 & Join"
          )}
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Payments are processed securely by Stripe. MAALI never stores your card details.
      </p>
    </form>
  );
};

// ─── Step 3 wrapper: fetches clientSecret then mounts Elements ───────────────

const StepPayment = ({
  onSuccess,
  onBack,
}: {
  onSuccess: () => void;
  onBack: () => void;
}) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    invokeWithAuth<{ clientSecret?: string; error?: string }>("create-membership-payment")
      .then(({ data, error }) => {
        if (error || !data?.clientSecret) {
          const msg =
            data?.error || parseEdgeFunctionError(error) || error?.message;
          setFetchError(
            msg ? `Could not initialise payment: ${msg}` : "Could not initialise payment. Please try again.",
          );
        } else {
          setClientSecret(data.clientSecret);
        }
      });
  }, []);

  if (fetchError) {
    return (
      <div className="space-y-4">
        <p className="text-destructive text-sm">{fetchError}</p>
        <Button variant="outline" onClick={onBack}>Go back</Button>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm onSuccess={onSuccess} onBack={onBack} />
    </Elements>
  );

};

// ─── Main Join page ──────────────────────────────────────────────────────────

type Step = "profile" | "tier" | "payment" | "done";

const EMPTY_PROFILE: ProfileData = {
  firstName: "",
  lastName: "",
  businessName: "",
  businessSector: "",
  country: "",
  bio: "",
};

const STEP_LABELS: { id: Step; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "tier", label: "Membership" },
  { id: "payment", label: "Payment" },
];

const Join = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("profile");
  const [profile, setProfile] = useState<ProfileData>({
    ...EMPTY_PROFILE,
    firstName: user?.user_metadata?.first_name ?? "",
    lastName: user?.user_metadata?.last_name ?? "",
  });
  const [selectedTier, setSelectedTier] = useState<"community" | "member" | null>(null);

  const stepIndex = STEP_LABELS.findIndex((s) => s.id === step);

  const saveProfileAndContinue = async (data: ProfileData) => {
    setProfile(data);

    if (user) {
      await supabase.from("profiles").upsert({
        user_id: user.id,
        first_name: data.firstName,
        last_name: data.lastName,
        business_name: data.businessName,
        business_sector: data.businessSector,
        country: data.country,
        bio: data.bio,
      });
    }

    setStep("tier");
  };

  const handleTierSelect = async (tier: "community" | "member") => {
    setSelectedTier(tier);

    if (tier === "community") {
      if (user) {
        await supabase.from("memberships").insert({
          user_id: user.id,
          tier: "community",
          status: "active",
          starts_at: new Date().toISOString(),
        });
      }
      setStep("done");
    } else {
      setStep("payment");
    }
  };

  // Membership row is created/activated by the Stripe webhook — nothing to do client-side
  const handlePaymentSuccess = () => setStep("done");

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-lg mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl font-bold mb-4">Sign up first</h2>
          <p className="text-muted-foreground mb-6">You need an account before joining MAALI.</p>
          <Button variant="hero" onClick={() => navigate("/auth")}>Create Account</Button>
        </main>
      </div>
    );
  }

  if (step === "done") {
    const isPaid = selectedTier === "member";
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-lg mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
            <Check className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-3xl font-bold mb-3">Welcome to Maali!</h2>
          <p className="text-muted-foreground mb-2">
            {isPaid
              ? "Your Full Membership is active. You can now apply to all funding opportunities."
              : "You've joined the Maali community network."}
          </p>
          {!isPaid && (
            <p className="text-sm text-muted-foreground mb-6">
              Upgrade to Full Member anytime to apply for funding.
            </p>
          )}
          <div className="flex gap-3 justify-center mt-8">
            <Button variant="outline" onClick={() => navigate("/")}>Go to Home</Button>
            <Button variant="hero" onClick={() => navigate("/projects")}>Browse Opportunities</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        {/* Progress stepper */}
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

        <Card className="shadow-elegant">
          <CardContent className="p-6 sm:p-8">
            {step === "profile" && (
              <StepProfile initial={profile} onNext={saveProfileAndContinue} />
            )}
            {step === "tier" && (
              <StepTier onNext={handleTierSelect} />
            )}
            {step === "payment" && (
              <StepPayment
                onSuccess={handlePaymentSuccess}
                onBack={() => setStep("tier")}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Join;
