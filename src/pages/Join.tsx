import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Users, Zap, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES } from "@/components/application/form/countries";
import Navigation from "@/components/Navigation";
import { MembershipPaymentStep } from "@/components/membership/MembershipPaymentStep";
import {
  getDefaultPaystackCurrency,
  type PaymentProviderChoice,
} from "@/lib/paymentProvider";

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
  const { t } = useTranslation("common");
  const { data: sectors = [] } = useSectors();
  const [form, setForm] = useState(initial);

  const set = (k: keyof ProfileData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid =
    form.firstName && form.lastName && form.businessName && form.businessSector && form.country;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t("join.profile.title")}</h2>
        <p className="text-muted-foreground mt-1">{t("join.profile.description")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">{t("join.profile.firstName")}</Label>
          <Input
            id="firstName"
            value={form.firstName}
            onChange={set("firstName")}
            placeholder={t("onboarding.profile.firstNamePlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">{t("join.profile.lastName")}</Label>
          <Input
            id="lastName"
            value={form.lastName}
            onChange={set("lastName")}
            placeholder={t("onboarding.profile.lastNamePlaceholder")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="businessName">{t("join.profile.businessName")}</Label>
        <Input
          id="businessName"
          value={form.businessName}
          onChange={set("businessName")}
          placeholder={t("join.profile.businessNamePlaceholder")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="businessSector">{t("join.profile.sector")}</Label>
          <select
            id="businessSector"
            value={form.businessSector}
            onChange={set("businessSector")}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="">{t("join.profile.sectorPlaceholder")}</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">{t("join.profile.country")}</Label>
          <select
            id="country"
            value={form.country}
            onChange={set("country")}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="">{t("join.profile.countryPlaceholder")}</option>
            {COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">{t("join.profile.bio")}</Label>
        <Textarea
          id="bio"
          value={form.bio}
          onChange={set("bio")}
          placeholder={t("join.profile.bioPlaceholder")}
          rows={3}
        />
      </div>

      <Button
        className="w-full"
        variant="hero"
        disabled={!valid}
        onClick={() => onNext(form)}
      >
        {t("join.profile.continue")} <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
};

const StepTier = ({
  onNext,
}: {
  onNext: (tier: "community" | "member") => void;
}) => {
  const { t } = useTranslation("common");

  const tiers = useMemo(
    () =>
      (["community", "member"] as const).map((id) => ({
        id,
        name: t(`join.tier.${id}.name`),
        price: t(`join.tier.${id}.price`),
        badge: id === "member" ? t("join.tier.mostPopular") : null,
        description: t(`join.tier.${id}.description`),
        features: t(`join.tier.${id}.features`, { returnObjects: true }) as string[],
        cta: t(`join.tier.${id}.cta`),
      })),
    [t],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t("join.tier.title")}</h2>
        <p className="text-muted-foreground mt-1">{t("join.tier.subtitle")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {tiers.map((tier) => (
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
};

const StepPayment = ({
  userId,
  billingEmail,
  countryHint,
  onSuccess,
  onBack,
}: {
  userId: string;
  billingEmail: string;
  countryHint: string;
  onSuccess: () => void;
  onBack: () => void;
}) => {
  const { t } = useTranslation("common");
  const [choice, setChoice] = useState<PaymentProviderChoice>({
    provider: "stripe",
    currency: getDefaultPaystackCurrency(countryHint),
  });

  return (
    <MembershipPaymentStep
      userId={userId}
      billingEmail={billingEmail}
      choice={choice}
      onChoiceChange={setChoice}
      onSuccess={onSuccess}
      onBack={onBack}
      defaultPaystackCurrency={getDefaultPaystackCurrency(countryHint)}
      title={t("onboarding.payment.title")}
      description={t("onboarding.payment.description", { price: t("join.memberPriceLabel") })}
      showBillingEmail={false}
    />
  );
};

type Step = "profile" | "tier" | "payment" | "done";

const EMPTY_PROFILE: ProfileData = {
  firstName: "",
  lastName: "",
  businessName: "",
  businessSector: "",
  country: "",
  bio: "",
};

const Join = () => {
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const stepLabels = useMemo(
    () =>
      (["profile", "tier", "payment"] as const).map((id) => ({
        id,
        label: t(`join.steps.${id}`),
      })),
    [t],
  );

  const [step, setStep] = useState<Step>("profile");
  const [profile, setProfile] = useState<ProfileData>({
    ...EMPTY_PROFILE,
    firstName: user?.user_metadata?.first_name ?? "",
    lastName: user?.user_metadata?.last_name ?? "",
  });
  const [selectedTier, setSelectedTier] = useState<"community" | "member" | null>(null);

  const stepIndex = stepLabels.findIndex((s) => s.id === step);

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

  const handlePaymentSuccess = () => setStep("done");

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-lg mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl font-bold mb-4">{t("join.noAccount.title")}</h2>
          <p className="text-muted-foreground mb-6">{t("join.noAccount.message")}</p>
          <Button variant="hero" onClick={() => navigate("/auth")}>{t("join.noAccount.cta")}</Button>
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
          <h2 className="text-3xl font-bold mb-3">{t("join.done.title")}</h2>
          <p className="text-muted-foreground mb-2">
            {isPaid ? t("join.done.paidDescription") : t("join.done.communityDescription")}
          </p>
          {!isPaid && (
            <p className="text-sm text-muted-foreground mb-6">{t("join.done.upgradeHint")}</p>
          )}
          <div className="flex gap-3 justify-center mt-8">
            <Button variant="outline" onClick={() => navigate("/")}>{t("join.done.goHome")}</Button>
            <Button variant="hero" onClick={() => navigate("/opportunities")}>
              {t("join.done.browseOpportunities")}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
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

        <Card className="shadow-elegant">
          <CardContent className="p-6 sm:p-8">
            {step === "profile" && (
              <StepProfile initial={profile} onNext={saveProfileAndContinue} />
            )}
            {step === "tier" && <StepTier onNext={handleTierSelect} />}
            {step === "payment" && (
              <StepPayment
                userId={user.id}
                billingEmail={user.email ?? ""}
                countryHint={profile.country}
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
