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
 * Calculate financial statistics
 */
async function fetchFinancialStats(): Promise<FinancialStats> {
  try {
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("amount, status, type, created_at, currency");

    if (error) {
      console.error("Error fetching financial stats:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      
      // Check if table doesn't exist
      if (error.code === "42P01" || error.message.includes("does not exist") || error.message.includes("relation")) {
        throw new Error("Transactions table not found. Please ensure migrations are up to date.");
      }
      
      // Check for permission errors
      if (error.code === "42501" || error.message.includes("permission") || error.message.includes("denied")) {
        throw new Error("Permission denied. Please ensure you have admin access and the transactions table has proper RLS policies.");
      }
      
      throw new Error(error.message || `Failed to load financial stats: ${error.code || "Unknown error"}`);
    }

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const completed = transactions?.filter((t) => t.status === "completed") || [];
  const pending = transactions?.filter((t) => t.status === "pending" || t.status === "processing") || [];
  const failed = transactions?.filter((t) => t.status === "failed" || t.status === "cancelled") || [];
  const refunded = transactions?.filter((t) => t.status === "refunded") || [];
  const applicationFees = completed.filter((t) => t.type === "application_fee");
  const subscriptions = completed.filter((t) => t.type === "subscription");

  const thisMonth = completed.filter(
    (t) => new Date(t.created_at) >= thisMonthStart
  );
  const lastMonth = completed.filter(
    (t) =>
      new Date(t.created_at) >= lastMonthStart &&
      new Date(t.created_at) <= lastMonthEnd
  );

  const totalRevenue =
    completed.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0) -
    refunded.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

  const thisMonthRevenue = thisMonth.reduce(
    (sum, t) => sum + parseFloat(t.amount.toString()),
    0
  );
  const lastMonthRevenue = lastMonth.reduce(
    (sum, t) => sum + parseFloat(t.amount.toString()),
    0
  );

    const revenueGrowth =
      lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : thisMonthRevenue > 0
        ? 100
        : 0;

    return {
      totalRevenue,
      totalTransactions: transactions?.length || 0,
      completedTransactions: completed.length,
      pendingTransactions: pending.length,
      failedTransactions: failed.length,
      refundedAmount: refunded.reduce(
        (sum, t) => sum + parseFloat(t.amount.toString()),
        0
      ),
      applicationFees: applicationFees.reduce(
        (sum, t) => sum + parseFloat(t.amount.toString()),
        0
      ),
      subscriptions: subscriptions.reduce(
        (sum, t) => sum + parseFloat(t.amount.toString()),
        0
      ),
      thisMonthRevenue,
      lastMonthRevenue,
      revenueGrowth: Math.round(revenueGrowth * 100) / 100,
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

