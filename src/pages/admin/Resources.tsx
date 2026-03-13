import { useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, Trash2, Eye, EyeOff, Download, ExternalLink, FileText, Video, Table2, Presentation, FileSpreadsheet, Link as LinkIcon } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, SortableColumnHeader } from "@/components/ui/data-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAdminResources,
  useDeleteResource,
  useToggleResourcePublished,
  RESOURCE_sectors,
  type Resource,
} from "@/hooks/useResources";

const getFileIcon = (fileType: string) => {
  switch (fileType) {
    case "pdf":
      return <FileText className="h-4 w-4" />;
    case "video":
    case "webinar":
      return <Video className="h-4 w-4" />;
    case "excel":
      return <Table2 className="h-4 w-4" />;
    case "powerpoint":
      return <Presentation className="h-4 w-4" />;
    case "word":
      return <FileSpreadsheet className="h-4 w-4" />;
    case "link":
    case "directory":
    case "event":
      return <LinkIcon className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const Resources = () => {
  const navigate = useNavigate();
  const { data: resources = [], isLoading, refetch, isFetching } = useAdminResources();
  const deleteResource = useDeleteResource();
  const togglePublished = useToggleResourcePublished();
  
  const [deleteConfirm, setDeleteConfirm] = useState<Resource | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Filter resources by sector (DataTable handles search internally)
  const filteredResources = useMemo(() => {
    if (categoryFilter === "all") return resources;
    return resources.filter(resource => resource.sector === categoryFilter);
  }, [resources, categoryFilter]);

  const handleTogglePublished = useCallback(async (resource: Resource) => {
    await togglePublished.mutateAsync({
      id: resource.id,
      is_published: !resource.is_published,
    });
  }, [togglePublished]);

  // Define columns for the resources table
  const resourceColumns: ColumnDef<any>[] = useMemo(() => [
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Title" />
      ),
      cell: ({ row }) => {
        const resource = row.original;
        return (
          <div className="flex items-center gap-2">
            {getFileIcon(resource.file_type)}
            <span className="font-medium">{resource.title}</span>
            {resource.is_featured && (
              <Badge variant="secondary">Featured</Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'sector',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="sector" />
      ),
      cell: ({ row }) => {
        return <span>{row.original.sector}</span>;
      },
    },
    {
      accessorKey: 'file_type',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => {
        return (
          <Badge variant="outline" className="uppercase text-xs">
            {row.original.file_type}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'size',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Size" />
      ),
      cell: ({ row }) => {
        const resource = row.original;
        return (
          <span className="text-sm text-muted-foreground">
            {resource.duration || formatFileSize(resource.file_size)}
          </span>
        );
      },
    },
    {
      accessorKey: 'download_count',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Downloads" />
      ),
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-1">
            <Download className="h-3 w-3 text-muted-foreground" />
            {row.original.download_count}
          </div>
        );
      },
    },
    {
      accessorKey: 'is_published',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const isPublished = row.original.is_published;
        return (
          <Badge variant={isPublished ? "default" : "secondary"}>
            {isPublished ? "Published" : "Draft"}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const resource = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleTogglePublished(resource)}
              title={resource.is_published ? "Unpublish" : "Publish"}
            >
              {resource.is_published ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
            {resource.file_url && (
              <Button
                variant="ghost"
                size="icon"
                asChild
                title="Open"
              >
                <a href={resource.file_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/admin/resources/${resource.id}`)}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteConfirm(resource)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      },
    },
  ], [navigate, handleTogglePublished]);

  const handleDelete = async () => {
    if (deleteConfirm) {
      await deleteResource.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            Manage downloadable materials and resources
          </p>
          <Button asChild>
            <Link to="/admin/resources/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Resource
            </Link>
          </Button>
        </div>

        {/* sector Filter */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by sector" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sectors</SelectItem>
                  {RESOURCE_sectors.map((sector) => (
                    <SelectItem key={sector} value={sector}>
                      {sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Resources Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Resources ({filteredResources.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="font-medium mb-2">No resources found</p>
                <p className="text-sm">Create your first resource to get started.</p>
              </div>
            ) : (
              <DataTable
                columns={resourceColumns}
                data={filteredResources}
                searchPlaceholder="Search by title, sector, or type..."
                pageSize={10}
                enableSorting={true}
                enablePagination={true}
                exportFileName="resources"
                onRefresh={() => { refetch(); }}
                isRefreshing={isFetching}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resource</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Resources;








