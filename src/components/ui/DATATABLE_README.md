# DataTable Component

A reusable, feature-rich data table component built with `@tanstack/react-table` and shadcn/ui components.

## Features

- ✅ **Sorting** - Click column headers to sort (ascending/descending)
- ✅ **Pagination** - Built-in pagination with customizable page sizes
- ✅ **Type-safe** - Full TypeScript support
- ✅ **Customizable** - Flexible column definitions
- ✅ **Responsive** - Mobile-friendly design

## Installation

The component uses `@tanstack/react-table` which should already be installed. If not:

```bash
npm install @tanstack/react-table
```

## Basic Usage

```tsx
import { ColumnDef } from "@tanstack/react-table"
import { DataTable, SortableColumnHeader } from "@/components/ui/data-table"

// Define your data type
interface User {
  id: string
  name: string
  email: string
  role: string
}

// Define columns
const columns: ColumnDef<User>[] = [
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
    accessorKey: "role",
    header: "Role",
  },
]

// Use the component
function MyComponent() {
  const data: User[] = [
    { id: "1", name: "John Doe", email: "john@example.com", role: "Admin" },
    { id: "2", name: "Jane Smith", email: "jane@example.com", role: "User" },
  ]

  return (
    <DataTable
      columns={columns}
      data={data}
      pageSize={10}
      enableSorting={true}
      enablePagination={true}
    />
  )
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `columns` | `ColumnDef<TData, TValue>[]` | Required | Column definitions from `@tanstack/react-table` |
| `data` | `TData[]` | Required | Array of data to display |
| `pageSize` | `number` | `10` | Number of rows per page |
| `enableSorting` | `boolean` | `true` | Enable/disable column sorting |
| `enablePagination` | `boolean` | `true` | Enable/disable pagination |
| `className` | `string` | `undefined` | Additional CSS classes |

## Column Definitions

### Basic Column

```tsx
{
  accessorKey: "name",
  header: "Name",
}
```

### Sortable Column

```tsx
{
  accessorKey: "name",
  header: ({ column }) => (
    <SortableColumnHeader column={column} title="Name" />
  ),
}
```

### Custom Cell Renderer

```tsx
{
  accessorKey: "status",
  header: "Status",
  cell: ({ row }) => {
    const status = row.getValue("status") as string
    return <Badge variant={status === "active" ? "default" : "secondary"}>
      {status}
    </Badge>
  },
}
```

### Actions Column

```tsx
{
  id: "actions",
  header: "Actions",
  cell: ({ row }) => {
    return (
      <Button
        variant="ghost"
        onClick={() => handleAction(row.original)}
      >
        View
      </Button>
    )
  },
}
```

## Examples

See `src/components/ui/data-table-example.tsx` for a complete example.

## Advanced Usage

### Custom Filtering

The component supports column filtering through `@tanstack/react-table`. You can add filters to columns:

```tsx
{
  accessorKey: "status",
  header: "Status",
  filterFn: (row, id, value) => {
    return value.includes(row.getValue(id))
  },
}
```

### Disable Pagination

```tsx
<DataTable
  columns={columns}
  data={data}
  enablePagination={false}
/>
```

### Disable Sorting

```tsx
<DataTable
  columns={columns}
  data={data}
  enableSorting={false}
/>
```

## Styling

The component uses shadcn/ui components and follows your theme. You can customize it by:

1. Modifying the component directly
2. Using the `className` prop
3. Overriding Tailwind classes in your global CSS

