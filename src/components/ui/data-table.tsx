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
} from "@tanstack/react-table"
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, X, Download, RotateCw } from "lucide-react"

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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  pageSize = 10,
  enableSorting = true,
  enablePagination = true,
  enableExport = true,
  exportFileName,
  className,
  onRefresh,
  isRefreshing = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
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

      // Extract headers from column definitions
      const headers: string[] = [];
      columns.forEach((column) => {
        // Skip action columns
        if ((column as any).id === 'actions') return;
        
        // Get header text
        const header = column.header;
        let headerText = '';
        
        if (typeof header === 'string') {
          headerText = header;
        } else if (typeof header === 'function') {
          // For function headers (like SortableColumnHeader), try to extract title
          // We'll use the accessorKey as fallback
          const accessorKey = (column as any).accessorKey || (column as any).id;
          // Try to get a readable name from the accessorKey
          if (accessorKey) {
            headerText = String(accessorKey)
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase())
              .trim();
          } else {
            headerText = 'Column';
          }
        } else {
          // For React elements or other types, use accessorKey
          const accessorKey = (column as any).accessorKey || (column as any).id;
          if (accessorKey) {
            headerText = String(accessorKey)
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase())
              .trim();
          } else {
            headerText = 'Column';
          }
        }
        
        headers.push(headerText);
      });

      // Extract row data
      const rows = filteredRows.map((row) => {
        return columns.map((column) => {
          // Skip action columns
          if ((column as any).id === 'actions') return '';
          
          const accessorKey = (column as any).accessorKey || (column as any).id;
          if (!accessorKey) return '';
          
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
            placeholder={searchPlaceholder}
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
              <span className="sr-only">Clear search</span>
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
            title="Refresh data"
          >
            <RotateCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="sr-only">Refresh</span>
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
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToCSV}>
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                Excel (coming soon)
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                PDF (coming soon)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="rounded-md border">
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
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {enablePagination && (
        <div className="flex items-center justify-between px-2">
          <div className="flex-1 text-sm text-muted-foreground">
            {table.getFilteredRowModel().rows.length} row(s) total.
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">Rows per page</p>
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
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
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









