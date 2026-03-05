import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Transaction = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  applicationId: string | null;
  projectId: number | null;
  projectTitle: string | null;
  type: "application_fee" | "subscription" | "refund" | "other";
  status: "pending" | "processing" | "completed" | "failed" | "refunded" | "cancelled";
  amount: number;
  currency: string;
  provider: string | null;
  providerTransactionId: string | null;
  description: string;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
  invoicePdfUrl: string | null;
  receiptUrl: string | null;
  billingEmail: string | null;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
  refundedAt: string | null;
};

export type FinancialStats = {
  totalRevenue: number;
  totalTransactions: number;
  completedTransactions: number;
  pendingTransactions: number;
  failedTransactions: number;
  refundedAmount: number;
  applicationFees: number;
  subscriptions: number;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  revenueGrowth: number;
};

/**
 * Fetch all transactions for admin financial management
 */
async function fetchAllTransactions(): Promise<Transaction[]> {
  try {
    // First, fetch all transactions
    const { data: transactionsData, error: transactionsError } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false });

    if (transactionsError) {
      console.error("Error fetching transactions:", {
        message: transactionsError.message,
        code: transactionsError.code,
        details: transactionsError.details,
        hint: transactionsError.hint,
      });
      
      // Check if table doesn't exist
      if (transactionsError.code === "42P01" || transactionsError.message.includes("does not exist") || transactionsError.message.includes("relation")) {
        throw new Error("Transactions table not found. Please ensure migrations are up to date.");
      }
      
      // Check for permission errors
      if (transactionsError.code === "42501" || transactionsError.message.includes("permission") || transactionsError.message.includes("denied")) {
        throw new Error("Permission denied. Please ensure you have admin access and the transactions table has proper RLS policies.");
      }
      
      throw new Error(transactionsError.message || `Failed to load transactions: ${transactionsError.code || "Unknown error"}`);
    }

    if (!transactionsData || transactionsData.length === 0) {
      return [];
    }

    // Get unique user IDs and project IDs
    const userIds = [...new Set(transactionsData.map((tx: any) => tx.user_id).filter(Boolean))];
    const projectIds = [...new Set(transactionsData.map((tx: any) => tx.project_id).filter(Boolean))];
    
    // Fetch profiles for all users
    const profilesMap = new Map<string, { firstName: string | null; lastName: string | null }>();
    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds);
      
      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
      } else if (profilesData) {
        profilesData.forEach((profile) => {
          profilesMap.set(profile.user_id, {
            firstName: profile.first_name,
            lastName: profile.last_name,
          });
        });
      }
    }

    // Get project titles for transactions that have project_id
    const projectsMap = new Map<number, string>();
    if (projectIds.length > 0) {
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select("id, title")
        .in("id", projectIds);
      
      if (projectsError) {
        console.error("Error fetching projects:", projectsError);
      } else if (projects) {
        projects.forEach((p) => {
          projectsMap.set(p.id, p.title);
        });
      }
    }

    // Transform transactions
    const transactionsWithDetails = transactionsData.map((tx: any) => {
      const profile = profilesMap.get(tx.user_id);
      const userName = profile && (profile.firstName || profile.lastName)
        ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim()
        : tx.billing_email || "Unknown User";
      
      const userEmail = tx.billing_email || "N/A";
      const projectTitle = tx.project_id ? projectsMap.get(tx.project_id) || null : null;

      return {
        id: tx.id,
        userId: tx.user_id,
        userName,
        userEmail,
        applicationId: tx.application_id,
        projectId: tx.project_id,
        projectTitle,
        type: tx.type,
        status: tx.status,
        amount: parseFloat(tx.amount),
        currency: tx.currency,
        provider: tx.provider,
        providerTransactionId: tx.provider_transaction_id,
        description: tx.description,
        invoiceNumber: tx.invoice_number,
        invoiceUrl: tx.invoice_url,
        invoicePdfUrl: tx.invoice_pdf_url,
        receiptUrl: tx.receipt_url,
        billingEmail: tx.billing_email,
        failureReason: tx.failure_reason,
        createdAt: tx.created_at,
        completedAt: tx.completed_at,
        refundedAt: tx.refunded_at,
      };
    });

    return transactionsWithDetails;
  } catch (err) {
    // Re-throw our custom errors
    if (err instanceof Error) {
      throw err;
    }
    // Handle unexpected errors
    console.error("Unexpected error in fetchAllTransactions:", err);
    throw new Error("An unexpected error occurred while loading transactions.");
  }
}

/**
 * Calculate financial statistics using optimized RPC function
 * This fetches only aggregated stats instead of all transactions (90%+ cost reduction)
 */
async function fetchFinancialStats(): Promise<FinancialStats> {
  try {
    const { data, error } = await supabase.rpc("get_financial_stats");

    if (error) {
      console.error("Error fetching financial stats:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      
      // Check if function doesn't exist
      if (error.code === "42883" || error.message.includes("does not exist") || error.message.includes("function")) {
        throw new Error("Financial stats function not found. Please ensure migrations are up to date.");
      }
      
      // Check for permission errors
      if (error.code === "42501" || error.message.includes("permission") || error.message.includes("denied")) {
        throw new Error("Permission denied. Please ensure you have admin access.");
      }
      
      throw new Error(error.message || `Failed to load financial stats: ${error.code || "Unknown error"}`);
    }

    if (!data || data.length === 0) {
      // Return zero stats if no data
      return {
        totalRevenue: 0,
        totalTransactions: 0,
        completedTransactions: 0,
        pendingTransactions: 0,
        failedTransactions: 0,
        refundedAmount: 0,
        applicationFees: 0,
        subscriptions: 0,
        thisMonthRevenue: 0,
        lastMonthRevenue: 0,
        revenueGrowth: 0,
      };
    }

    const stats = data[0];

    return {
      totalRevenue: parseFloat(stats.total_revenue?.toString() || "0"),
      totalTransactions: stats.total_transactions || 0,
      completedTransactions: stats.completed_transactions || 0,
      pendingTransactions: stats.pending_transactions || 0,
      failedTransactions: stats.failed_transactions || 0,
      refundedAmount: parseFloat(stats.refunded_amount?.toString() || "0"),
      applicationFees: parseFloat(stats.application_fees?.toString() || "0"),
      subscriptions: parseFloat(stats.subscriptions?.toString() || "0"),
      thisMonthRevenue: parseFloat(stats.this_month_revenue?.toString() || "0"),
      lastMonthRevenue: parseFloat(stats.last_month_revenue?.toString() || "0"),
      revenueGrowth: parseFloat(stats.revenue_growth?.toString() || "0"),
    };
  } catch (err) {
    // Re-throw our custom errors
    if (err instanceof Error) {
      throw err;
    }
    // Handle unexpected errors
    console.error("Unexpected error in fetchFinancialStats:", err);
    throw new Error("An unexpected error occurred while loading financial statistics.");
  }
}

/**
 * Hook to fetch all transactions for admin
 */
export function useTransactions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["admin-transactions"],
    queryFn: fetchAllTransactions,
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
    retry: 1,
  });
}

/**
 * Hook to fetch financial statistics
 */
export function useFinancialStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["admin-financial-stats"],
    queryFn: fetchFinancialStats,
    enabled: !!user,
    staleTime: 60 * 1000, // 1 minute
    retry: 1,
  });
}

