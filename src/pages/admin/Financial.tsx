import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  FileText,
  Calendar,
  Filter,
} from "lucide-react";
import { useTransactions, useFinancialStats, Transaction } from "@/hooks/useFinancialData";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { getPaymentStatusBadge } from "@/lib/statusBadges";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, SortableColumnHeader } from "@/components/ui/data-table";

const AdminFinancial = () => {
  const { t } = useTranslation(["dashboard", "common"]);
  // application_fee rows are historical; new revenue is membership (see /join)
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");

  const { 
    data: transactions = [], 
    isLoading: transactionsLoading, 
    error: transactionsError,
    refetch: refetchTransactions,
    isFetching: isFetchingTransactions
  } = useTransactions();
  const { data: stats, isLoading: statsLoading, error: statsError } = useFinancialStats();


  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      application_fee: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      subscription: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      refund: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      other: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    };
    return (
      <Badge className={colors[type] || "bg-gray-500/10 text-gray-500 border-gray-500/20"}>
        {type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
      </Badge>
    );
  };

  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((tx) => tx.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((tx) => tx.type === typeFilter);
    }

    // Date range filter
    if (dateRange !== "all") {
      const now = new Date();
      let startDate: Date;
      switch (dateRange) {
        case "today":
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case "week":
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case "month":
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case "year":
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          startDate = new Date(0);
      }
      filtered = filtered.filter((tx) => new Date(tx.createdAt) >= startDate);
    }

    return filtered;
  }, [transactions, statusFilter, typeFilter, dateRange]);

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  // Define columns for the transactions table
  const transactionColumns: ColumnDef<Transaction>[] = useMemo(() => [
    {
      accessorKey: 'amount',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title={t("admin.financialPage.columns.amount")} />
      ),
      cell: ({ row }) => {
        const tx = row.original;
        return (
          <span className="font-semibold">
            {formatCurrency(tx.amount, tx.currency)}
          </span>
        );
      },
      sortingFn: (rowA, rowB) => {
        return rowA.original.amount - rowB.original.amount;
      },
    },
    {
      accessorKey: 'userName',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title={t("admin.financialPage.columns.user")} />
      ),
      cell: ({ row }) => {
        const tx = row.original;
        return (
          <div>
            <p className="font-medium">{tx.userName}</p>
            <p className="text-xs text-muted-foreground">{tx.userEmail}</p>
          </div>
        );
      },
    },
    {
      accessorKey: 'description',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title={t("admin.financialPage.columns.description")} />
      ),
      cell: ({ row }) => {
        return <span className="text-sm">{row.original.description}</span>;
      },
    },
    {
      accessorKey: 'type',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title={t("admin.financialPage.columns.type")} />
      ),
      cell: ({ row }) => {
        return getTypeBadge(row.original.type);
      },
      sortingFn: (rowA, rowB) => {
        return rowA.original.type.localeCompare(rowB.original.type);
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title={t("admin.financialPage.columns.status")} />
      ),
      cell: ({ row }) => {
        return getPaymentStatusBadge(row.original.status, t);
      },
      sortingFn: (rowA, rowB) => {
        return rowA.original.status.localeCompare(rowB.original.status);
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title={t("admin.financialPage.columns.date")} />
      ),
      cell: ({ row }) => {
        return (
          <span className="text-sm text-muted-foreground">
            {format(new Date(row.original.createdAt), "MMM d, yyyy")}
          </span>
        );
      },
      sortingFn: (rowA, rowB) => {
        const dateA = new Date(rowA.original.createdAt).getTime();
        const dateB = new Date(rowB.original.createdAt).getTime();
        return dateA - dateB;
      },
    },
    {
      accessorKey: 'projectTitle',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title={t("admin.financialPage.columns.project")} />
      ),
      cell: ({ row }) => {
        const projectTitle = row.original.projectTitle;
        return projectTitle ? (
          <span className="text-sm">{projectTitle}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{t("admin.financialPage.columns.na")}</span>
        );
      },
    },
    {
      accessorKey: 'invoiceNumber',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title={t("admin.financialPage.columns.invoice")} />
      ),
      cell: ({ row }) => {
        const invoiceNumber = row.original.invoiceNumber;
        return invoiceNumber ? (
          <span className="text-sm font-mono">{invoiceNumber}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{t("admin.financialPage.columns.na")}</span>
        );
      },
    },
    {
      id: 'actions',
      header: t("admin.financialPage.columns.actions"),
      cell: ({ row }) => {
        const tx = row.original;
        return (
          <div className="flex items-center gap-2">
            {tx.invoiceUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={tx.invoiceUrl} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4 mr-2" />
                  {t("admin.financialPage.columns.invoiceBtn")}
                </a>
              </Button>
            )}
            {(tx.invoicePdfUrl || tx.receiptUrl) && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={tx.invoicePdfUrl || tx.receiptUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t("admin.financialPage.columns.receiptBtn")}
                </a>
              </Button>
            )}
          </div>
        );
      },
    },
  ], [t]);

  const fp = "admin.financialPage";

  if (transactionsLoading || statsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t(`${fp}.title`)}</h1>
          <p className="text-muted-foreground mt-2">{t(`${fp}.subtitle`)}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (transactionsError || statsError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t(`${fp}.title`)}</h1>
          <p className="text-muted-foreground mt-2">{t(`${fp}.subtitle`)}</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive">
              {t(`${fp}.loadError`, {
                message:
                  transactionsError instanceof Error
                    ? transactionsError.message
                    : statsError instanceof Error
                    ? statsError.message
                    : "Unknown error",
              })}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{t(`${fp}.title`)}</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          {t(`${fp}.subtitle`)}
        </p>
      </div>

      {/* Financial Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{t(`${fp}.stats.totalRevenue`)}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">
              {formatCurrency(stats?.totalRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
              {t(`${fp}.stats.allTimeRevenue`)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{t(`${fp}.stats.thisMonth`)}</CardTitle>
            <TrendingUp className="h-4 w-4 text-success hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">
              {formatCurrency(stats?.thisMonthRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
              {stats?.revenueGrowth !== undefined && stats.revenueGrowth > 0 ? (
                <span className="text-success">{t(`${fp}.stats.revenueGrowthUp`, { percent: stats.revenueGrowth.toFixed(1) })}</span>
              ) : stats?.revenueGrowth !== undefined ? (
                <span className="text-destructive">{t(`${fp}.stats.revenueGrowthDown`, { percent: stats.revenueGrowth.toFixed(1) })}</span>
              ) : (
                t(`${fp}.stats.monthlyRevenue`)
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{t(`${fp}.stats.completed`)}</CardTitle>
            <CheckCircle className="h-4 w-4 text-success hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stats?.completedTransactions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
              {t(`${fp}.stats.successfulTransactions`)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{t(`${fp}.stats.pending`)}</CardTitle>
            <Clock className="h-4 w-4 text-warning hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stats?.pendingTransactions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
              {t(`${fp}.stats.awaitingProcessing`)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{t(`${fp}.stats.revenueBreakdown`)}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">{t(`${fp}.stats.applicationFees`)}</span>
                <span className="text-base sm:text-lg font-semibold">
                  {formatCurrency(stats?.applicationFees || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">{t(`${fp}.stats.subscriptions`)}</span>
                <span className="text-base sm:text-lg font-semibold">
                  {formatCurrency(stats?.subscriptions || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">{t(`${fp}.stats.refunded`)}</span>
                <span className="text-base sm:text-lg font-semibold text-destructive">
                  -{formatCurrency(stats?.refundedAmount || 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{t(`${fp}.stats.transactionStatus`)}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">{t(`${fp}.stats.total`)}</span>
                <span className="text-base sm:text-lg font-semibold">
                  {stats?.totalTransactions || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">{t(`${fp}.stats.failed`)}</span>
                <span className="text-base sm:text-lg font-semibold text-destructive">
                  {stats?.failedTransactions || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{t(`${fp}.stats.monthlyComparison`)}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">{t(`${fp}.stats.thisMonth`)}</span>
                <span className="text-base sm:text-lg font-semibold">
                  {formatCurrency(stats?.thisMonthRevenue || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">{t(`${fp}.stats.lastMonth`)}</span>
                <span className="text-base sm:text-lg font-semibold">
                  {formatCurrency(stats?.lastMonthRevenue || 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px] min-h-[44px] sm:min-h-0">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t(`${fp}.filters.status`)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t(`${fp}.filters.allStatus`)}</SelectItem>
                  <SelectItem value="completed">{t(`${fp}.filters.completed`)}</SelectItem>
                  <SelectItem value="pending">{t(`${fp}.filters.pending`)}</SelectItem>
                  <SelectItem value="processing">{t(`${fp}.filters.processing`)}</SelectItem>
                  <SelectItem value="failed">{t(`${fp}.filters.failed`)}</SelectItem>
                  <SelectItem value="refunded">{t(`${fp}.filters.refunded`)}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[160px] min-h-[44px] sm:min-h-0">
                  <SelectValue placeholder={t(`${fp}.filters.type`)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t(`${fp}.filters.allTypes`)}</SelectItem>
                  <SelectItem value="application_fee">{t(`${fp}.filters.applicationFee`)}</SelectItem>
                  <SelectItem value="subscription">{t(`${fp}.filters.subscription`)}</SelectItem>
                  <SelectItem value="refund">{t(`${fp}.filters.refund`)}</SelectItem>
                  <SelectItem value="other">{t(`${fp}.filters.other`)}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-full sm:w-[140px] min-h-[44px] sm:min-h-0">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t(`${fp}.filters.date`)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t(`${fp}.filters.allTime`)}</SelectItem>
                  <SelectItem value="today">{t(`${fp}.filters.today`)}</SelectItem>
                  <SelectItem value="week">{t(`${fp}.filters.last7Days`)}</SelectItem>
                  <SelectItem value="month">{t(`${fp}.filters.lastMonth`)}</SelectItem>
                  <SelectItem value="year">{t(`${fp}.filters.lastYear`)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">
            {t(`${fp}.transactions`, { count: filteredTransactions.length })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <DataTable
            columns={transactionColumns}
            data={filteredTransactions}
            searchPlaceholder={t(`${fp}.searchPlaceholder`)}
            pageSize={10}
            enableSorting={true}
            enablePagination={true}
            enableExport={true}
            exportFileName="transactions"
            onRefresh={() => {
              refetchTransactions();
            }}
            isRefreshing={isFetchingTransactions}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminFinancial;









