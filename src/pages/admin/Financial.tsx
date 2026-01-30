import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  Download,
  FileText,
  Calendar,
  Filter,
} from "lucide-react";
import { useTransactions, useFinancialStats } from "@/hooks/useFinancialData";
import { Skeleton } from "@/components/ui/skeleton";
import { format, formatDistanceToNow } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AdminFinancial = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");

  const { data: transactions = [], isLoading: transactionsLoading, error: transactionsError } = useTransactions();
  const { data: stats, isLoading: statsLoading, error: statsError } = useFinancialStats();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-success/10 text-success border-success/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "pending":
      case "processing":
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20">
            <Clock className="h-3 w-3 mr-1" />
            {status === "pending" ? "Pending" : "Processing"}
          </Badge>
        );
      case "failed":
      case "cancelled":
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20">
            <XCircle className="h-3 w-3 mr-1" />
            {status === "failed" ? "Failed" : "Cancelled"}
          </Badge>
        );
      case "refunded":
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            <RefreshCw className="h-3 w-3 mr-1" />
            Refunded
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (tx) =>
          tx.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.providerTransactionId?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

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
  }, [transactions, searchQuery, statusFilter, typeFilter, dateRange]);

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  if (transactionsLoading || statsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Financial Management</h1>
          <p className="text-muted-foreground mt-2">Overview of all financial transactions and revenue</p>
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
          <h1 className="text-3xl font-bold">Financial Management</h1>
          <p className="text-muted-foreground mt-2">Overview of all financial transactions and revenue</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive">
              Error loading financial data:{" "}
              {transactionsError instanceof Error
                ? transactionsError.message
                : statsError instanceof Error
                ? statsError.message
                : "Unknown error"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Financial Management</h1>
        <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
          Overview of all financial transactions and revenue
        </p>
      </div>

      {/* Financial Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">
              {formatCurrency(stats?.totalRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
              All time revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-success hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">
              {formatCurrency(stats?.thisMonthRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
              {stats?.revenueGrowth !== undefined && stats.revenueGrowth > 0 ? (
                <span className="text-success">+{stats.revenueGrowth.toFixed(1)}% vs last month</span>
              ) : stats?.revenueGrowth !== undefined ? (
                <span className="text-destructive">{stats.revenueGrowth.toFixed(1)}% vs last month</span>
              ) : (
                "Monthly revenue"
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-success hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stats?.completedTransactions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
              Successful transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-warning hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{stats?.pendingTransactions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
              Awaiting processing
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Revenue Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">Application Fees</span>
                <span className="text-base sm:text-lg font-semibold">
                  {formatCurrency(stats?.applicationFees || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">Subscriptions</span>
                <span className="text-base sm:text-lg font-semibold">
                  {formatCurrency(stats?.subscriptions || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">Refunded</span>
                <span className="text-base sm:text-lg font-semibold text-destructive">
                  -{formatCurrency(stats?.refundedAmount || 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Transaction Status</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">Total</span>
                <span className="text-base sm:text-lg font-semibold">
                  {stats?.totalTransactions || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">Failed</span>
                <span className="text-base sm:text-lg font-semibold text-destructive">
                  {stats?.failedTransactions || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Monthly Comparison</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">This Month</span>
                <span className="text-base sm:text-lg font-semibold">
                  {formatCurrency(stats?.thisMonthRevenue || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">Last Month</span>
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
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user, description, invoice..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 min-h-[44px] sm:min-h-0"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px] min-h-[44px] sm:min-h-0">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[160px] min-h-[44px] sm:min-h-0">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="application_fee">Application Fee</SelectItem>
                  <SelectItem value="subscription">Subscription</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-full sm:w-[140px] min-h-[44px] sm:min-h-0">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last Month</SelectItem>
                  <SelectItem value="year">Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg">
              Transactions ({filteredTransactions.length})
            </CardTitle>
            <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-0">
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm sm:text-base">
              No transactions found matching your criteria.
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {filteredTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-3 sm:gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="font-semibold text-sm sm:text-base truncate">
                        {formatCurrency(tx.amount, tx.currency)}
                      </h3>
                      {getStatusBadge(tx.status)}
                      {getTypeBadge(tx.type)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                      <span className="font-medium truncate">{tx.userName}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="truncate">{tx.description}</span>
                      {tx.projectTitle && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="truncate">{tx.projectTitle}</span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(tx.createdAt), "MMM d, yyyy")}
                      </span>
                      {tx.invoiceNumber && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {tx.invoiceNumber}
                          </span>
                        </>
                      )}
                      {tx.provider && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span>{tx.provider}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {tx.invoiceUrl && (
                      <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-0">
                        <FileText className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Invoice</span>
                      </Button>
                    )}
                    {tx.receiptUrl && (
                      <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-0">
                        <Download className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Receipt</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminFinancial;

