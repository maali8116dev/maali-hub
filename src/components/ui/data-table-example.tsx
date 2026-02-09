/**
 * Example usage of the DataTable component
 * 
 * This file demonstrates how to use the reusable DataTable component
 * with sorting and pagination.
 */

import { ColumnDef } from "@tanstack/react-table"
import { DataTable, SortableColumnHeader } from "./data-table"
import { Badge } from "./badge"
import { Button } from "./button"

// Example data type
interface ExampleData {
  id: string
  name: string
  email: string
  status: "active" | "inactive" | "pending"
  createdAt: string
}

// Example columns definition
const columns: ColumnDef<ExampleData>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <SortableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <SortableColumnHeader column={column} title="Email" />
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <Badge
          variant={
            status === "active"
              ? "default"
              : status === "pending"
              ? "secondary"
              : "destructive"
          }
        >
          {status}
        </Badge>
      )
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <SortableColumnHeader column={column} title="Created At" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue("createdAt"))
      return date.toLocaleDateString()
    },
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => {
            // Handle action
            console.log("Action for:", row.original.id)
          }}
        >
          View
        </Button>
      )
    },
  },
]

// Example usage component
export function ExampleDataTable() {
  const exampleData: ExampleData[] = [
    {
      id: "1",
      name: "John Doe",
      email: "john@example.com",
      status: "active",
      createdAt: "2024-01-01",
    },
    {
      id: "2",
      name: "Jane Smith",
      email: "jane@example.com",
      status: "pending",
      createdAt: "2024-01-02",
    },
    // ... more data
  ]

  return (
    <DataTable
      columns={columns}
      data={exampleData}
      pageSize={10}
      enableSorting={true}
      enablePagination={true}
    />
  )
}

