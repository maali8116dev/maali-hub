import { useState } from "react";
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

const Billing = () => {
  const { toast } = useToast();
  const { user } = useAuth();
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

  // Fetch billing history (transactions) from DB
  const { data: billingHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["user-transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
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
      toast({ title: "Billing information saved", description: "Your billing address has been updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        queryClient.invalidateQueries({ queryKey: ["user-payment-methods"] });
        const message = paymentMethodToDelete.isOnlyOne
          ? "Your payment method has been removed. You'll need to add a new payment method for future transactions."
          : paymentMethodToDelete.isDefault
          ? "Your payment method has been removed. Another payment method has been set as default."
          : "Your payment method has been removed.";
        toast({ title: "Payment method removed", description: message });
      }
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to delete payment method", 
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
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["user-payment-methods"] });
      toast({ title: "Default payment method updated" });
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

  const handleDownloadInvoice = async (
    transactionId: string,
    _receiptUrl: string | null,
    invoicePdfUrl: string | null,
    forceRegenerate: boolean = false
  ) => {
    // Priority 1: Use stored PDF receipt if available (unless forcing regeneration)
    if (invoicePdfUrl && !forceRegenerate) {
      try {
        const response = await fetch(invoicePdfUrl);
        if (response.ok) {
          const blob = await response.blob();
          triggerPdfDownload(blob, `receipt-${transactionId.substring(0, 8)}.pdf`);
          toast({ title: "Success", description: "Invoice downloaded." });
          return;
        }
      } catch (err) {
        console.warn("[Invoice] Failed to download stored PDF, falling back:", err);
      }
    }

    // Priority 2: Generate PDF on-demand (skip Stripe receipt URL - it's a web page, not a PDF)
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast({ title: "Error", description: "You must be logged in to download invoices.", variant: "destructive" });
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const invoiceUrl = `${supabaseUrl}/functions/v1/generate-invoice?transactionId=${transactionId}`;
      
      console.log("[Invoice] Fetching:", invoiceUrl);
      
      const res = await fetch(invoiceUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      });

      console.log("[Invoice] Response status:", res.status, res.statusText);
      console.log("[Invoice] Response content-type:", res.headers.get("content-type"));

      if (!res.ok) {
        const errorBody = await res.text();
        console.error("[Invoice] Error body:", errorBody);
        throw new Error(`Failed to generate invoice: ${res.status}`);
      }

      const blob = await res.blob();
      console.log("[Invoice] PDF blob size:", blob.size, "bytes");
      console.log("[Invoice] PDF blob type:", blob.type);
      
      // Verify it's actually a PDF
      if (!blob.type.includes("pdf") && blob.size < 1000) {
        console.error("[Invoice] Warning: Response may not be a valid PDF");
        const text = await blob.text();
        console.error("[Invoice] Response content:", text.substring(0, 200));
      }
      triggerPdfDownload(blob, `invoice-${transactionId.substring(0, 8)}.pdf`);
      toast({ title: "Success", description: "Invoice downloaded." });
    } catch (err) {
      console.error("[Invoice] Download failed:", err);
      toast({ title: "Error", description: "Failed to download invoice.", variant: "destructive" });
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
            <CheckCircle2 className="h-3 w-3 mr-1" /> Paid
          </Badge>
        );
      case "pending":
      case "processing":
        return (
          <Badge variant="secondary" className="text-xs">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Pending
          </Badge>
        );
      case "refunded":
        return (
          <Badge variant="outline" className="text-xs">Refunded</Badge>
        );
      default:
        return (
          <Badge variant="destructive" className="text-xs">
            <XCircle className="h-3 w-3 mr-1" /> Failed
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          Manage your payment methods and view billing history
        </p>
      </div>

      {/* Payment Methods */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <CreditCard className="h-5 w-5" />
                Payment Methods
              </CardTitle>
              <CardDescription className="mt-1 text-xs sm:text-sm">
                Manage your payment methods for application fees
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
              <p>No payment methods on file</p>
              <p className="text-xs sm:text-sm mt-2">
                Payment methods are saved automatically when you pay an application fee via Stripe
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
                          <Badge variant="default" className="text-xs">Primary</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Secondary</Badge>
                        )}
                      </div>
                      {method.expiry_month && method.expiry_year && (
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Expires {method.expiry_month}/{method.expiry_year}
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
                        Set as Default
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
            Billing History
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            View your past transactions and invoices
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
              <p>No billing history yet</p>
              <p className="text-xs sm:text-sm mt-2">Your transactions will appear here</p>
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
                    {item.invoice_number && (
                      <p className="text-xs text-muted-foreground">Invoice: {item.invoice_number}</p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
onClick={() => handleDownloadInvoice(item.id, null, item.invoice_pdf_url)}
                      className="w-full min-h-[44px] gap-2 text-primary hover:text-primary"
                    >
                      <Download className="h-4 w-4" />
                      Download Receipt
                    </Button>
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
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
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {item.invoice_number || "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.amount, item.currency)}
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadInvoice(item.id, null, item.invoice_pdf_url)}
                            className="min-h-[44px] gap-2 text-primary hover:text-primary"
                          >
                            <Download className="h-4 w-4" />
                            Receipt
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
          <CardTitle className="text-base sm:text-lg">Billing Information</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Update your billing address and tax information
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
                  <Label htmlFor="billingEmail">Billing Email</Label>
                  <Input
                    id="billingEmail"
                    name="billingEmail"
                    type="email"
                    defaultValue={billingAddress?.billing_email || user?.email || ""}
                    className="h-11 sm:h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxId">Tax ID (Optional)</Label>
                  <Input
                    id="taxId"
                    name="taxId"
                    placeholder="Enter your tax ID"
                    defaultValue={billingAddress?.tax_id || ""}
                    className="h-11 sm:h-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingAddress">Billing Address</Label>
                <Input
                  id="billingAddress"
                  name="billingAddress"
                  placeholder="Street address"
                  defaultValue={billingAddress?.address_line1 || ""}
                  required
                  className="h-11 sm:h-10"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    placeholder="City"
                    defaultValue={billingAddress?.city || ""}
                    required
                    className="h-11 sm:h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State/Province</Label>
                  <Input
                    id="state"
                    name="state"
                    placeholder="State"
                    defaultValue={billingAddress?.state_province || ""}
                    className="h-11 sm:h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">ZIP/Postal Code</Label>
                  <Input
                    id="zipCode"
                    name="zipCode"
                    placeholder="ZIP Code"
                    defaultValue={billingAddress?.postal_code || ""}
                    required
                    className="h-11 sm:h-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  name="country"
                  placeholder="Country"
                  defaultValue={billingAddress?.country || ""}
                  required
                  className="h-11 sm:h-10"
                />
              </div>
              <Button
                type="submit"
                disabled={saveBillingAddress.isPending}
                className="min-h-[44px] w-full sm:w-auto"
              >
                {saveBillingAddress.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Billing Information"
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
                ? "Delete Your Only Payment Method?" 
                : "Delete Payment Method?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {paymentMethodToDelete?.isOnlyOne ? (
                <>
                  This is your only payment method. If you delete it, you'll need to add a new payment method 
                  before making any future payments. Are you sure you want to continue?
                </>
              ) : paymentMethodToDelete?.isDefault ? (
                <>
                  This is your default payment method. It will be removed and another payment method will be 
                  set as default. Are you sure you want to continue?
                </>
              ) : (
                "Are you sure you want to remove this payment method? This action cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingPaymentMethod !== null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => paymentMethodToDelete && handleDeletePaymentMethod(paymentMethodToDelete.id)}
              disabled={isDeletingPaymentMethod !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingPaymentMethod ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Billing;








