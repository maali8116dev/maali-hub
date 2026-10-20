import * as React from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  ColumnFiltersState,
  getFilteredRowModel,
  VisibilityState,
} from "@tanstack/react-table"
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, X, Download, RotateCw, Columns3 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslation } from "react-i18next"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchPlaceholder?: string
  pageSize?: number
  enableSorting?: boolean
  enablePagination?: boolean
  enableExport?: boolean
  exportFileName?: string
  className?: string
  onRefresh?: () => void | Promise<void>
  isRefreshing?: boolean
  enableColumnVisibility?: boolean
  initialColumnVisibility?: VisibilityState
  /** Use inside Card — single outer border, no nested table box */
  embedded?: boolean
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder,
  pageSize = 10,
  enableSorting = true,
  enablePagination = true,
  enableExport = true,
  exportFileName,
  className,
  onRefresh,
  isRefreshing = false,
  enableColumnVisibility = false,
  initialColumnVisibility,
  embedded = false,
}: DataTableProps<TData, TValue>) {
  const { t } = useTranslation("common")
  const resolvedSearchPlaceholder = searchPlaceholder ?? t("dataTable.search")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    initialColumnVisibility ?? {},
  )
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: pageSize,
  })

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    onSortingChange: enableSorting ? setSorting : undefined,
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onPaginationChange: enablePagination ? setPagination : undefined,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: enableColumnVisibility ? setColumnVisibility : undefined,
    globalFilterFn: (row, columnId, filterValue) => {
      if (!filterValue) return true;
      
      const searchValue = filterValue.toLowerCase();
      
      // If searchKey is specified, only search that column
      if (searchKey) {
        const cellValue = row.getValue(searchKey);
        if (cellValue === null || cellValue === undefined) return false;
        return String(cellValue).toLowerCase().includes(searchValue);
      }
      
      // Otherwise, search across all visible columns and nested data
      const rowData = row.original as any;
      
      // Helper function to recursively search in nested objects
      const searchInObject = (obj: any): boolean => {
        if (obj === null || obj === undefined) return false;
        
        if (typeof obj === 'string') {
          return obj.toLowerCase().includes(searchValue);
        }
        
        if (typeof obj === 'number' || typeof obj === 'boolean') {
          return String(obj).toLowerCase().includes(searchValue);
        }
        
        if (Array.isArray(obj)) {
          return obj.some(item => searchInObject(item));
        }
        
        if (typeof obj === 'object') {
          return Object.values(obj).some(value => searchInObject(value));
        }
        
        return false;
      };
      
      // Search in all column values
      return columns.some((column) => {
        const accessorKey = (column as any).accessorKey;
        if (!accessorKey) return false;
        
        try {
          // Try to get the value using the accessor key
          const keys = accessorKey.split('.');
          let cellValue: any = rowData;
          
          for (const key of keys) {
            if (cellValue === null || cellValue === undefined) break;
            cellValue = cellValue[key];
          }
          
          if (cellValue === null || cellValue === undefined) return false;
          return searchInObject(cellValue);
        } catch {
          // If accessor key fails, try searching the entire row data
          return searchInObject(rowData);
        }
      }) || searchInObject(rowData);
    },
    state: {
      sorting: enableSorting ? sorting : undefined,
      columnFilters,
      globalFilter,
      pagination: enablePagination ? pagination : undefined,
      columnVisibility: enableColumnVisibility ? columnVisibility : undefined,
    },
    manualPagination: false,
  })

  // Export to CSV function
  const exportToCSV = () => {
    try {
      // Get all filtered and sorted rows (not just current page)
      const filteredRows = table.getFilteredRowModel().rows;
      
      if (filteredRows.length === 0) {
        return;
      }

      // Extract headers from visible column definitions
      const headers: string[] = [];
      const exportColumns = table.getVisibleLeafColumns().filter((column) => column.id !== "actions");

      exportColumns.forEach((column) => {
        const meta = column.columnDef.meta as { label?: string } | undefined;
        if (meta?.label) {
          headers.push(meta.label);
          return;
        }

        const accessorKey = column.id;
        headers.push(
          String(accessorKey)
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase())
            .trim(),
        );
      });

      // Extract row data
      const rows = filteredRows.map((row) => {
        return exportColumns.map((column) => {
          const accessorKey = column.id;
          if (!accessorKey) return "";
          
          // Get the raw value from the row
          let value: any;
          try {
            // Use table's getValue method which handles accessor keys properly
            value = row.getValue(accessorKey);
            
            // If getValue returns undefined, try accessing the original data directly
            if (value === undefined && typeof accessorKey === 'string') {
              const keys = accessorKey.split('.');
              value = row.original as any;
              for (const key of keys) {
                if (value === null || value === undefined) break;
                value = value[key];
              }
            }
          } catch {
            value = '';
          }

          // Convert value to string, handling various types
          if (value === null || value === undefined) {
            return '';
          }
          
          if (typeof value === 'object') {
            // For objects, try to extract meaningful text
            if (Array.isArray(value)) {
              return value.map(String).join(', ');
            }
            // For nested objects, try to get a string representation
            if (value.toString && value.toString() !== '[object Object]') {
              return String(value);
            }
            // Otherwise, return empty string for complex objects
            return '';
          }
          
          // For dates, format them nicely
          if (value instanceof Date) {
            return value.toLocaleDateString();
          }
          
          return String(value);
        });
      });

      // Create CSV content
      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          row
            .map((cell) => {
              // Escape quotes and wrap in quotes if contains comma, newline, or quote
              const cellValue = String(cell).replace(/"/g, '""');
              if (cellValue.includes(',') || cellValue.includes('\n') || cellValue.includes('"')) {
                return `"${cellValue}"`;
              }
              return cellValue;
            })
            .join(",")
        ),
      ].join("\n");

      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      
      // Generate filename
      const fileName = exportFileName 
        ? `${exportFileName}-${new Date().toISOString().split('T')[0]}.csv`
        : `export-${new Date().toISOString().split('T')[0]}.csv`;
      
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search Input, Refresh, and Export Button */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={resolvedSearchPlaceholder}
            value={globalFilter}
            onChange={(e) => {
              setGlobalFilter(e.target.value);
              // Reset to first page when searching
              table.setPageIndex(0);
            }}
            className="pl-8 pr-8"
          />
          {globalFilter && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-7 w-7"
              onClick={() => {
                setGlobalFilter("");
                table.setPageIndex(0);
              }}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">{t("dataTable.clearSearch")}</span>
            </Button>
          )}
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => onRefresh()}
            disabled={isRefreshing}
            className="h-9 w-9"
            title={t("dataTable.refreshData")}
          >
            <RotateCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="sr-only">{t("dataTable.refresh")}</span>
          </Button>
        )}
        {enableExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {t("dataTable.export")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToCSV}>
                {t("dataTable.csv")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                {t("dataTable.excelSoon")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                {t("dataTable.pdfSoon")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {enableColumnVisibility && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Columns3 className="h-4 w-4" />
                {t("dataTable.columns")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>{t("dataTable.toggleColumns")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  const meta = column.columnDef.meta as { label?: string } | undefined;
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {meta?.label ?? column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className={cn(embedded ? "border-t" : "rounded-md border")}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length || columns.length}
                  className="h-24 text-center"
                >
                  {t("dataTable.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {enablePagination && (
        <div className="flex items-center justify-between px-2">
          <div className="flex-1 text-sm text-muted-foreground">
            {t("dataTable.rowsTotal", { count: table.getFilteredRowModel().rows.length })}
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">{t("dataTable.rowsPerPage")}</p>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value))
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={table.getState().pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
              {t("dataTable.pageOf", {
                current: table.getState().pagination.pageIndex + 1,
                total: table.getPageCount(),
              })}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">{t("dataTable.firstPage")}</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">{t("dataTable.previousPage")}</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">{t("dataTable.nextPage")}</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">{t("dataTable.lastPage")}</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper component for sortable column headers
export function SortableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: {
  column: any
  title: string
  className?: string
}) {
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      className={cn("h-8 -ml-3 px-2 hover:bg-transparent", className)}
    >
      <span>{title}</span>
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  )
}









