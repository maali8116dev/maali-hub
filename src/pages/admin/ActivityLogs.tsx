import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Activity, User, FileText, FolderOpen, Clock, CalendarIcon, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, FileSpreadsheet, Printer } from "lucide-react";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ActivityLog } from "@/hooks/useActivityLogs";

const actionTypeColors: Record<string, string> = {
  create: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  delete: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  view: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  login: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  logout: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  submit: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approve: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  reject: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const entityTypeIcons: Record<string, React.ReactNode> = {
  project: <FolderOpen className="h-4 w-4" />,
  application: <FileText className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
  blog_post: <FileText className="h-4 w-4" />,
  profile: <User className="h-4 w-4" />,
  document: <FileText className="h-4 w-4" />,
};

const PAGE_SIZE = 15;

export default function ActivityLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading } = useActivityLogs({
    limit: PAGE_SIZE,
    page: currentPage,
    actionType: actionFilter !== "all" ? actionFilter : undefined,
    entityType: entityFilter !== "all" ? entityFilter : undefined,
    startDate,
    endDate,
  });

  const logs = data?.logs || [];
  const totalPages = data?.totalPages || 1;
  const totalCount = data?.totalCount || 0;

  const filteredLogs = logs.filter((log) =>
    log.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const clearDateFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setCurrentPage(1);
  };

  // Reset to page 1 when filters change
  const handleActionFilterChange = (value: string) => {
    setActionFilter(value);
    setCurrentPage(1);
  };

  const handleEntityFilterChange = (value: string) => {
    setEntityFilter(value);
    setCurrentPage(1);
  };

  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date);
    setCurrentPage(1);
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date);
    setCurrentPage(1);
  };

  // Fetch all logs for export (bypassing pagination)
  const fetchAllLogsForExport = async (): Promise<ActivityLog[]> => {
    let query = supabase
      .from('activity_logs_safe' as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (actionFilter !== "all") {
      query = query.eq('action_type', actionFilter);
    }

    if (entityFilter !== "all") {
      query = query.eq('entity_type', entityFilter);
    }

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endOfDay.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return ((data as any[]) || []).map((log): ActivityLog => ({
      id: log.id,
      userId: log.user_id,
      actionType: log.action_type,
      entityType: log.entity_type,
      entityId: log.entity_id,
      description: log.description,
      metadata: log.metadata as Record<string, unknown> | null,
      createdAt: log.created_at,
    }));
  };

  const exportToCSV = async () => {
    try {
      toast.loading("Preparing CSV export...");
      const allLogs = await fetchAllLogsForExport();
      
      // Filter by search query if present
      const logsToExport = searchQuery 
        ? allLogs.filter(log => log.description.toLowerCase().includes(searchQuery.toLowerCase()))
        : allLogs;

      if (logsToExport.length === 0) {
        toast.dismiss();
        toast.error("No logs to export");
        return;
      }

      // Create CSV content
      const headers = ["Date", "Action", "Entity Type", "Entity ID", "Description"];
      const rows = logsToExport.map(log => [
        format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss"),
        log.actionType,
        log.entityType.replace('_', ' '),
        log.entityId || "N/A",
        `"${log.description.replace(/"/g, '""')}"` // Escape quotes in description
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.join(","))
      ].join("\n");

      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `activity-logs-${format(new Date(), "yyyy-MM-dd")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success(`Exported ${logsToExport.length} logs to CSV`);
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to export logs");
      console.error("Export error:", error);
    }
  };

  const printLogs = async () => {
    try {
      toast.loading("Preparing print view...");
      const allLogs = await fetchAllLogsForExport();
      
      // Filter by search query if present
      const logsToExport = searchQuery 
        ? allLogs.filter(log => log.description.toLowerCase().includes(searchQuery.toLowerCase()))
        : allLogs;

      if (logsToExport.length === 0) {
        toast.dismiss();
        toast.error("No logs to print");
        return;
      }

      // Create print window content
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Activity Logs Report - ${format(new Date(), "yyyy-MM-dd")}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; margin-bottom: 5px; }
            .subtitle { color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr:nth-child(even) { background-color: #fafafa; }
            .badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
            .create, .approve { background-color: #dcfce7; color: #166534; }
            .update { background-color: #dbeafe; color: #1e40af; }
            .delete, .reject { background-color: #fee2e2; color: #991b1b; }
            .login, .logout { background-color: #f3e8ff; color: #6b21a8; }
            .submit { background-color: #fef9c3; color: #854d0e; }
            .view { background-color: #f3f4f6; color: #374151; }
            .footer { margin-top: 20px; font-size: 11px; color: #666; }
          </style>
        </head>
        <body>
          <h1>Activity Logs Report</h1>
          <p class="subtitle">
            Generated on ${format(new Date(), "MMMM d, yyyy 'at' HH:mm")}
            ${startDate || endDate ? ` • Date range: ${startDate ? format(startDate, "MMM d, yyyy") : "Start"} to ${endDate ? format(endDate, "MMM d, yyyy") : "End"}` : ""}
            ${actionFilter !== "all" ? ` • Action: ${actionFilter}` : ""}
            ${entityFilter !== "all" ? ` • Entity: ${entityFilter}` : ""}
          </p>
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              ${logsToExport.map(log => `
                <tr>
                  <td>${format(new Date(log.createdAt), "MMM d, yyyy HH:mm")}</td>
                  <td><span class="badge ${log.actionType}">${log.actionType}</span></td>
                  <td>${log.entityType.replace('_', ' ')}</td>
                  <td>${log.description}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p class="footer">Total: ${logsToExport.length} entries</p>
        </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.print();
        };
      }

      toast.dismiss();
      toast.success("Print view opened");
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to prepare print view");
      console.error("Print error:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity Logs</h1>
        <p className="text-muted-foreground">
          Track and monitor all user and admin interactions
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                View all actions performed across the platform
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToCSV}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export to CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={printLogs}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print / Save as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 mb-6">
            {/* Search and main filters row */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search activities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={actionFilter} onValueChange={handleActionFilterChange}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Action Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                  <SelectItem value="submit">Submit</SelectItem>
                  <SelectItem value="approve">Approve</SelectItem>
                  <SelectItem value="reject">Reject</SelectItem>
                </SelectContent>
              </Select>
              <Select value={entityFilter} onValueChange={handleEntityFilterChange}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Entity Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  <SelectItem value="project">Projects</SelectItem>
                  <SelectItem value="application">Applications</SelectItem>
                  <SelectItem value="user">Users</SelectItem>
                  <SelectItem value="blog_post">Blog Posts</SelectItem>
                  <SelectItem value="profile">Profiles</SelectItem>
                  <SelectItem value="document">Documents</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date range filters row */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <span className="text-sm text-muted-foreground">Date range:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[180px] justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "MMM d, yyyy") : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={handleStartDateChange}
                    disabled={(date) => (endDate ? date > endDate : false) || date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <span className="text-sm text-muted-foreground hidden sm:inline">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[180px] justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "MMM d, yyyy") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={handleEndDateChange}
                    disabled={(date) => (startDate ? date < startDate : false) || date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {(startDate || endDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearDateFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear dates
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <h3 className="mt-4 text-lg font-semibold">No activity logs</h3>
              <p className="text-muted-foreground">
                Activity will appear here as users interact with the platform.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead className="hidden lg:table-cell">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={actionTypeColors[log.actionType] || ""}
                        >
                          {log.actionType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {entityTypeIcons[log.entityType] || <Activity className="h-4 w-4" />}
                          <span className="capitalize">{log.entityType.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-md truncate">
                        {log.description}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className="text-sm">
                            {format(new Date(log.createdAt), "MMM d, yyyy HH:mm")}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * PAGE_SIZE) + 1} to {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} entries
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
