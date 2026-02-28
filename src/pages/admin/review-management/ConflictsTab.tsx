import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable, SortableColumnHeader } from '@/components/ui/data-table';

export const ConflictsTab = () => {
  const { data: conflicts = [], refetch, isFetching } = useQuery({
    queryKey: ['all-conflicts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviewer_conflicts')
        .select(`
          *,
          reviewer:profiles!reviewer_id(user_id, first_name, last_name),
          application:applications!application_id(id, project_title)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const conflictColumns: ColumnDef<any>[] = useMemo(() => [
    {
      accessorKey: 'reviewer',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Reviewer" />
      ),
      cell: ({ row }) => {
        const conflict = row.original;
        const reviewer = conflict.reviewer;
        return reviewer ? (
          <span className="font-medium">
            {reviewer.first_name} {reviewer.last_name}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Unknown</span>
        );
      },
      sortingFn: (rowA, rowB) => {
        const nameA = `${rowA.original.reviewer?.first_name || ''} ${rowA.original.reviewer?.last_name || ''}`.trim();
        const nameB = `${rowB.original.reviewer?.first_name || ''} ${rowB.original.reviewer?.last_name || ''}`.trim();
        return nameA.localeCompare(nameB);
      },
    },
    {
      accessorKey: 'application',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Application" />
      ),
      cell: ({ row }) => {
        const conflict = row.original;
        const application = conflict.application;
        return application?.project_title ? (
          <span className="text-sm">{application.project_title}</span>
        ) : (
          <span className="text-xs text-muted-foreground">N/A</span>
        );
      },
      sortingFn: (rowA, rowB) => {
        const titleA = rowA.original.application?.project_title || '';
        const titleB = rowB.original.application?.project_title || '';
        return titleA.localeCompare(titleB);
      },
    },
    {
      accessorKey: 'conflict_reason',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Reason" />
      ),
      cell: ({ row }) => {
        return (
          <Badge variant="outline">
            {row.original.conflict_reason}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Declared" />
      ),
      cell: ({ row }) => {
        const createdAt = row.original.created_at;
        return createdAt ? (
          <span className="text-sm text-muted-foreground">
            {new Date(createdAt).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">N/A</span>
        );
      },
      sortingFn: (rowA, rowB) => {
        const dateA = new Date(rowA.original.created_at || 0).getTime();
        const dateB = new Date(rowB.original.created_at || 0).getTime();
        return dateA - dateB;
      },
    },
  ], []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reviewer Conflicts</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={conflictColumns}
          data={conflicts}
          searchPlaceholder="Search by reviewer name or application title..."
          pageSize={10}
          enableSorting={true}
          enablePagination={true}
          onRefresh={() => refetch()}
          isRefreshing={isFetching}
        />
      </CardContent>
    </Card>
  );
};

