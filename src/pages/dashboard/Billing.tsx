import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard,
  Plus,
  Trash2,
  Download,
  Receipt,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { MembershipProfileSection } from "@/components/profile/MembershipProfileSection";
import { UpgradeMembershipModal } from "@/components/membership/UpgradeMembershipModal";
import { useMembership } from "@/hooks/useMembership";
import { COUNTRIES } from "@/components/application/form/countries";

const upgradeCtaClass =
  "text-primary underline-offset-4 hover:underline font-inherit bg-transparent border-0 p-0 cursor-pointer inline";

type BillingHistoryRow = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  created_at: string;
  invoice_number: string | null;
  invoice_pdf_url: string | null;
  provider_payment_intent_id?: string | null;
  stripe_invoice_id?: string | null;
};

const Billing = () => {
  const { toast } = useToast();
  const { t } = useTranslation(["dashboard", "common"]);
  const { user } = useAuth();
  const { membership, isPaidMember, loading: membershipLoading } = useMembership();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { data: hasPendingCheckout = false } = useQuery({
    queryKey: ["user-membership-pending", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("memberships")
        .select("id")
        .eq("user_id", user!.id)
        .eq("status", "pending_payment")
        .limit(1)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !isPaidMember,
  });
  const queryClient = useQueryClient();
  const [isDeletingPaymentMethod, setIsDeletingPaymentMethod] = useState<string | null>(null);
  const [showAddCardDialog, setShowAddCardDialog] = useState(false);
  const [paymentMethodToDelete, setPaymentMethodToDelete] = useState<{ id: string; isDefault: boolean; isOnlyOne: boolean } | null>(null);

  // Fetch payment methods from DB
  const { data: paymentMethods = [], isLoading: loadingPaymentMethods } = useQuery({
    queryKey: ["user-payment-methods", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("is_default", { ascending: false }) // Default/primary first
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Sort by method_type: primary first, then secondary
      return (data || []).sort((a, b) => {
        if (a.method_type === "primary" && b.method_type !== "primary") return -1;
        if (a.method_type !== "primary" && b.method_type === "primary") return 1;
        return 0;
      });
    },
    enabled: !!user,
  });

  // Billing history: transactions + membership payments missing a transaction row
  const { data: billingHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["user-billing-history", user?.id],
    queryFn: async () => {
      const [txRes, mbrRes] = await Promise.all([
        supabase
          .from("transactions")
          .select(
            "id, description, amount, currency, status, type, created_at, invoice_number, invoice_pdf_url, provider_payment_intent_id"
          )
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("memberships")
          .select("id, stripe_payment_intent_id, amount_paid, created_at, status, tier")
          .eq("user_id", user!.id)
          .not("stripe_payment_intent_id", "is", null)
          .order("created_at", { ascending: false }),
      ]);
      if (txRes.error) throw txRes.error;
      if (mbrRes.error) throw mbrRes.error;

      let transactions = txRes.data || [];

      // Backfill missing INV- numbers for completed rows (legacy membership inserts)
      const needsInvoice = transactions.filter(
        (t) => t.status === "completed" && !t.invoice_number?.trim(),
      );
      if (needsInvoice.length > 0) {
        const results = await Promise.all(
          needsInvoice.map((t) =>
            supabase.rpc("assign_invoice_number_if_missing", { p_transaction_id: t.id }),
          ),
        );
        const invoiceById = new Map<string, string>();
        needsInvoice.forEach((t, i) => {
          const { data: inv, error } = results[i];
          if (error) {
            console.warn("[Billing] invoice backfill failed:", t.id, error.message);
            return;
          }
          if (inv) invoiceById.set(t.id, inv as string);
        });
        if (invoiceById.size > 0) {
          transactions = transactions.map((t) =>
            invoiceById.has(t.id) ? { ...t, invoice_number: invoiceById.get(t.id)! } : t,
          );
        }
      }

      const coveredPi = new Set(
        transactions
          .map((t) => t.provider_payment_intent_id)
          .filter((id): id is string => !!id),
      );

      const fromTx: BillingHistoryRow[] = transactions.map((t) => ({
        id: t.id,
        description: t.description,
        amount: Number(t.amount),
        currency: t.currency,
        status: t.status,
        type: t.type,
        created_at: t.created_at,
        invoice_number: t.invoice_number,
        invoice_pdf_url: t.invoice_pdf_url,
        provider_payment_intent_id: t.provider_payment_intent_id,
        stripe_invoice_id: (t as { stripe_invoice_id?: string | null }).stripe_invoice_id ?? null,
      }));

      const fromMembership: BillingHistoryRow[] = (mbrRes.data || [])
        .filter(
          (m) =>
            m.tier === "member" &&
            m.stripe_payment_intent_id &&
            !coveredPi.has(m.stripe_payment_intent_id),
        )
        .map((m) => ({
          id: `membership-${m.id}`,
          description: "Full Membership — MAALI ($2/month)",
          amount: (m.amount_paid ?? 200) / 100,
          currency: "USD",
          status: m.status === "active" ? "completed" : "pending",
          type: "subscription",
          created_at: m.created_at,
          invoice_number: null,
          invoice_pdf_url: null,
          provider_payment_intent_id: m.stripe_payment_intent_id,
        }));

      return [...fromTx, ...fromMembership].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
    enabled: !!user,
  });

  // Fetch billing address from DB
  const { data: billingAddress, isLoading: loadingAddress } = useQuery({
    queryKey: ["user-billing-address", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_addresses")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_default", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Save billing address mutation
  const saveBillingAddress = useMutation({
    mutationFn: async (formData: {
      billing_email: string;
      tax_id: string;
      address_line1: string;
      city: string;
      state_province: string;
      postal_code: string;
      country: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      if (billingAddress) {
        const { error } = await supabase
          .from("billing_addresses")
          .update({
            billing_email: formData.billing_email || null,
            tax_id: formData.tax_id || null,
            address_line1: formData.address_line1,
            city: formData.city,
            state_province: formData.state_province || null,
            postal_code: formData.postal_code,
            country: formData.country,
          })
          .eq("id", billingAddress.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("billing_addresses").insert({
          user_id: user.id,
          billing_email: formData.billing_email || null,
          tax_id: formData.tax_id || null,
          address_line1: formData.address_line1,
          city: formData.city,
          state_province: formData.state_province || null,
          postal_code: formData.postal_code,
          country: formData.country,
          is_default: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-billing-address"] });
      toast({ title: t("dashboard:billingPage.toasts.saved"), description: t("dashboard:billingPage.toasts.savedDesc") });
    },
    onError: (err: Error) => {
      toast({ title: t("dashboard:billingPage.toasts.error"), description: err.message, variant: "destructive" });
    },
  });

  // Delete (soft) payment method with proper handling
  const handleDeletePaymentMethod = async (id: string) => {
    if (!user || !paymentMethodToDelete) return;

    setIsDeletingPaymentMethod(id);
    
    try {
      // If it's the default/primary, find another active payment method to set as default
      if (paymentMethodToDelete.isDefault) {
        const { data: otherMethods } = await supabase
          .from("payment_methods")
          .select("id")
          .eq("user_id", user.id)
          .neq("id", id)
          .is("deleted_at", null)
          .eq("is_active", true)
          .limit(1);

        if (otherMethods && otherMethods.length > 0) {
          // Set the first available method as default (trigger handles method_type automatically)
          await supabase
            .from("payment_methods")
            .update({ is_default: true })
            .eq("id", otherMethods[0].id);
        }
      }

      // Soft delete the payment method (trigger handles method_type automatically)
      const { error } = await supabase
        .from("payment_methods")
        .update({ 
          deleted_at: new Date().toISOString(), 
          is_active: false,
          is_default: false,
        })
        .eq("id", id);

      if (error) {
        toast({ title: t("dashboard:billingPage.toasts.error"), description: error.message, variant: "destructive" });
      } else {
        queryClient.invalidateQueries({ queryKey: ["user-payment-methods"] });
        const message = paymentMethodToDelete.isOnlyOne
          ? t("dashboard:billingPage.toasts.removedOnly")
          : paymentMethodToDelete.isDefault
          ? t("dashboard:billingPage.toasts.removedWithDefault")
          : t("dashboard:billingPage.toasts.removedGeneric");
        toast({ title: t("dashboard:billingPage.toasts.removed"), description: message });
      }
    } catch (error) {
      toast({ 
        title: t("dashboard:billingPage.toasts.error"), 
        description: error instanceof Error ? error.message : t("dashboard:billingPage.toasts.deleteFailed"), 
        variant: "destructive" 
      });
    } finally {
      setIsDeletingPaymentMethod(null);
      setPaymentMethodToDelete(null);
    }
  };

  // Prepare deletion with confirmation
  const confirmDeletePaymentMethod = (method: { id: string; is_default: boolean }) => {
    const isOnlyOne = paymentMethods.filter(m => m.id !== method.id && !m.deleted_at && m.is_active).length === 0;
    setPaymentMethodToDelete({ 
      id: method.id, 
      isDefault: method.is_default, 
      isOnlyOne 
    });
  };

  // Set default payment method (trigger automatically handles primary/secondary)
  const handleSetDefault = async (id: string) => {
    if (!user) return;

    // Just set the new default -the trigger automatically unsets the old default
    // and handles primary/secondary classification
    const { error } = await supabase
      .from("payment_methods")
      .update({ is_default: true })
      .eq("id", id);

    if (error) {
      toast({ title: t("dashboard:billingPage.toasts.error"), description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["user-payment-methods"] });
      toast({ title: t("dashboard:billingPage.toasts.defaultUpdated") });
    }
  };

  const triggerPdfDownload = (blob: Blob, filename: string) => {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Delay revoke slightly so browsers have time to start the download reliably.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const handleDownloadInvoice = async (item: BillingHistoryRow) => {
    const isMembershipPlaceholder = item.id.startsWith("membership-");
    const canGenerate =
      !isMembershipPlaceholder || !!item.provider_payment_intent_id;

    if (!canGenerate) {
      toast({
        title: t("dashboard:billingPage.toasts.receiptUnavailable"),
        description: t("dashboard:billingPage.toasts.receiptUnavailableDesc"),
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast({ title: t("dashboard:billingPage.toasts.error"), description: t("dashboard:billingPage.toasts.loginRequired"), variant: "destructive" });
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const params = new URLSearchParams();
      if (item.stripe_invoice_id) {
        // Subscription renewal — look up by Stripe invoice ID
        params.set("stripeInvoiceId", item.stripe_invoice_id);
      } else if (isMembershipPlaceholder && item.provider_payment_intent_id) {
        // Legacy membership placeholder row
        params.set("paymentIntentId", item.provider_payment_intent_id);
      } else {
        params.set("transactionId", item.id);
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/generate-invoice?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      });

      if (!res.ok) {
        const errorBody = await res.text();
        console.error("[Invoice] Error:", errorBody);
        throw new Error(`Failed to generate invoice: ${res.status}`);
      }

      const blob = await res.blob();
      if (!blob.type.includes("pdf") && blob.size < 1000) {
        throw new Error("Invalid PDF response");
      }

      const fileStem = (item.invoice_number ?? item.id).replace(/[^a-zA-Z0-9-]/g, "");
      triggerPdfDownload(blob, `invoice-${fileStem}.pdf`);
      toast({ title: t("dashboard:billingPage.toasts.saved"), description: t("dashboard:billingPage.toasts.invoiceDownloaded") });
      queryClient.invalidateQueries({ queryKey: ["user-billing-history"] });
    } catch (err) {
      console.error("[Invoice] Download failed:", err);
      toast({ title: t("dashboard:billingPage.toasts.error"), description: t("dashboard:billingPage.toasts.downloadFailed"), variant: "destructive" });
    }
  };

  const handleSaveBillingInfo = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    saveBillingAddress.mutate({
      billing_email: formData.get("billingEmail") as string,
      tax_id: formData.get("taxId") as string,
      address_line1: formData.get("billingAddress") as string,
      city: formData.get("city") as string,
      state_province: formData.get("state") as string,
      postal_code: formData.get("zipCode") as string,
      country: formData.get("country") as string,
    });
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-500 text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" /> {t("dashboard:billingPage.status.paid")}
          </Badge>
        );
      case "pending":
      case "processing":
        return (
          <Badge variant="secondary" className="text-xs">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> {t("dashboard:billingPage.status.pending")}
          </Badge>
        );
      case "refunded":
        return (
          <Badge variant="outline" className="text-xs">{t("dashboard:billingPage.status.refunded")}</Badge>
        );
      default:
        return (
          <Badge variant="destructive" className="text-xs">
            <XCircle className="h-3 w-3 mr-1" /> {t("dashboard:billingPage.status.failed")}
          </Badge>
        );
    }
  };

  const upgradeLink = (
    <button type="button" className={upgradeCtaClass} onClick={() => setUpgradeOpen(true)} />
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{t("dashboard:billingPage.title")}</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          {t("dashboard:billingPage.subtitle")}
        </p>
      </div>

      <MembershipProfileSection />

      {/* Payment Methods */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <CreditCard className="h-5 w-5" />
                {t("dashboard:billingPage.paymentMethods.title")}
              </CardTitle>
              <CardDescription className="mt-1 text-xs sm:text-sm">
                {t("dashboard:billingPage.paymentMethods.description")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {loadingPaymentMethods ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : paymentMethods.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t("dashboard:billingPage.paymentMethods.empty")}</p>
              <p className="text-xs sm:text-sm mt-2 max-w-md mx-auto">
                {membershipLoading ? (
                  t("dashboard:billingPage.paymentMethods.loading")
                ) : isPaidMember ? (
                  <Trans
                    i18nKey="dashboard:billingPage.paymentMethods.paidMemberHint"
                    components={{ link: upgradeLink }}
                  />
                ) : hasPendingCheckout ? (
                  <Trans
                    i18nKey="dashboard:billingPage.paymentMethods.pendingCheckoutHint"
                    components={{ link: upgradeLink }}
                  />
                ) : (
                  <Trans
                    i18nKey="dashboard:billingPage.paymentMethods.upgradeHint"
                    components={{ link: upgradeLink }}
                  />
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg gap-3"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-primary/10 rounded-lg">
                      <CreditCard className="h-5 sm:h-6 w-5 sm:w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-sm sm:text-base">
                          {method.brand || method.type} •••• {method.last4}
                        </p>
                        {method.method_type === "primary" ? (
                          <Badge variant="default" className="text-xs">{t("dashboard:billingPage.paymentMethods.primary")}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">{t("dashboard:billingPage.paymentMethods.secondary")}</Badge>
                        )}
                      </div>
                      {method.expiry_month && method.expiry_year && (
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {t("dashboard:billingPage.paymentMethods.expires", {
                            month: method.expiry_month,
                            year: method.expiry_year,
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    {!method.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(method.id)}
                        className="min-h-[44px] text-xs sm:text-sm"
                      >
                        {t("dashboard:billingPage.paymentMethods.setDefault")}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => confirmDeletePaymentMethod(method)}
                      disabled={isDeletingPaymentMethod === method.id}
                      className="min-h-[44px] min-w-[44px]"
                    >
                      {isDeletingPaymentMethod === method.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Receipt className="h-5 w-5" />
            {t("dashboard:billingPage.history.title")}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {t("dashboard:billingPage.history.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {loadingHistory ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : billingHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t("dashboard:billingPage.history.empty")}</p>
              <p className="text-xs sm:text-sm mt-2">
                <Trans
                  i18nKey="dashboard:billingPage.history.emptyHint"
                  components={{ link: upgradeLink }}
                />
              </p>
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="block sm:hidden space-y-3">
                {billingHistory.map((item) => (
                  <div key={item.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm flex-1">{item.description}</p>
                      {getStatusBadge(item.status)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDate(item.created_at)}</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(item.amount, item.currency)}
                      </span>
                    </div>
                    {item.type === "subscription" && (
                      <Badge variant="secondary" className="text-xs">{t("dashboard:billingPage.history.membership")}</Badge>
                    )}
                    <p className="text-xs text-muted-foreground font-mono">
                      {t("dashboard:billingPage.history.invoice", { number: item.invoice_number ?? "—" })}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadInvoice(item)}
                      className="w-full min-h-[44px] gap-2 text-primary hover:text-primary"
                    >
                      <Download className="h-4 w-4" />
                      {t("dashboard:billingPage.history.downloadReceipt")}
                    </Button>
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("dashboard:billingPage.history.columns.date")}</TableHead>
                      <TableHead>{t("dashboard:billingPage.history.columns.description")}</TableHead>
                      <TableHead>{t("dashboard:billingPage.history.columns.invoice")}</TableHead>
                      <TableHead className="text-right">{t("dashboard:billingPage.history.columns.amount")}</TableHead>
                      <TableHead>{t("dashboard:billingPage.history.columns.status")}</TableHead>
                      <TableHead className="text-right">{t("dashboard:billingPage.history.columns.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billingHistory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDate(item.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span>{item.description}</span>
                            {item.type === "subscription" && (
                              <Badge variant="secondary" className="w-fit text-xs">Membership</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono">
                          {item.invoice_number ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.amount, item.currency)}
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadInvoice(item)}
                            className="min-h-[44px] gap-2 text-primary hover:text-primary"
                          >
                            <Download className="h-4 w-4" />
                            {t("dashboard:billingPage.history.receipt")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Billing Information */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">{t("dashboard:billingPage.info.title")}</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {t("dashboard:billingPage.info.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {loadingAddress ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form onSubmit={handleSaveBillingInfo} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="billingEmail">{t("dashboard:billingPage.info.billingEmail")}</Label>
                  <Input
                    id="billingEmail"
                    name="billingEmail"
                    type="email"
                    defaultValue={billingAddress?.billing_email || user?.email || ""}
                    className="h-11 sm:h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxId">{t("dashboard:billingPage.info.taxId")}</Label>
                  <Input
                    id="taxId"
                    name="taxId"
                    placeholder={t("dashboard:billingPage.info.taxIdPlaceholder")}
                    defaultValue={billingAddress?.tax_id || ""}
                    className="h-11 sm:h-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingAddress">{t("dashboard:billingPage.info.address")}</Label>
                <Input
                  id="billingAddress"
                  name="billingAddress"
                  placeholder={t("dashboard:billingPage.info.addressPlaceholder")}
                  defaultValue={billingAddress?.address_line1 || ""}
                  required
                  className="h-11 sm:h-10"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">{t("dashboard:billingPage.info.city")}</Label>
                  <Input
                    id="city"
                    name="city"
                    placeholder={t("dashboard:billingPage.info.cityPlaceholder")}
                    defaultValue={billingAddress?.city || ""}
                    required
                    className="h-11 sm:h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">{t("dashboard:billingPage.info.state")}</Label>
                  <Input
                    id="state"
                    name="state"
                    placeholder={t("dashboard:billingPage.info.statePlaceholder")}
                    defaultValue={billingAddress?.state_province || ""}
                    className="h-11 sm:h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">{t("dashboard:billingPage.info.zip")}</Label>
                  <Input
                    id="zipCode"
                    name="zipCode"
                    placeholder={t("dashboard:billingPage.info.zipPlaceholder")}
                    defaultValue={billingAddress?.postal_code || ""}
                    required
                    className="h-11 sm:h-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">{t("dashboard:billingPage.info.country")}</Label>
                <select
                  id="country"
                  name="country"
                  defaultValue={billingAddress?.country || ""}
                  required
                  className="flex h-11 sm:h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="" disabled>
                    {t("dashboard:billingPage.info.countryPlaceholder")}
                  </option>
                  {billingAddress?.country &&
                    !COUNTRIES.some((c) => c.value === billingAddress.country) && (
                      <option value={billingAddress.country}>{billingAddress.country}</option>
                    )}
                  {COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <Button
                type="submit"
                disabled={saveBillingAddress.isPending}
                className="min-h-[44px] w-full sm:w-auto"
              >
                {saveBillingAddress.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("dashboard:billingPage.info.saving")}
                  </>
                ) : (
                  t("dashboard:billingPage.info.save")
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Delete Payment Method Confirmation Dialog */}
      <AlertDialog open={!!paymentMethodToDelete} onOpenChange={(open) => !open && setPaymentMethodToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {paymentMethodToDelete?.isOnlyOne 
                ? t("dashboard:billingPage.deleteDialog.onlyTitle")
                : t("dashboard:billingPage.deleteDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {paymentMethodToDelete?.isOnlyOne
                ? t("dashboard:billingPage.deleteDialog.onlyDesc")
                : paymentMethodToDelete?.isDefault
                ? t("dashboard:billingPage.deleteDialog.defaultDesc")
                : t("dashboard:billingPage.deleteDialog.genericDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingPaymentMethod !== null}>
              {t("dashboard:billingPage.deleteDialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => paymentMethodToDelete && handleDeletePaymentMethod(paymentMethodToDelete.id)}
              disabled={isDeletingPaymentMethod !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingPaymentMethod ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("dashboard:billingPage.deleteDialog.deleting")}
                </>
              ) : (
                t("dashboard:billingPage.deleteDialog.delete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradeMembershipModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
};

export default Billing;








