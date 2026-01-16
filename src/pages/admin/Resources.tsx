import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Eye, EyeOff, Download, ExternalLink, FileText, Video, Table2, Presentation, FileSpreadsheet, Link as LinkIcon } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  RESOURCE_CATEGORIES,
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
  const { data: resources, isLoading } = useAdminResources();
  const deleteResource = useDeleteResource();
  const togglePublished = useToggleResourcePublished();
  
  const [deleteConfirm, setDeleteConfirm] = useState<Resource | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filteredResources = resources?.filter(resource => 
    categoryFilter === "all" || resource.category === categoryFilter
  );

  const handleDelete = async () => {
    if (deleteConfirm) {
      await deleteResource.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const handleTogglePublished = async (resource: Resource) => {
    await togglePublished.mutateAsync({
      id: resource.id,
      is_published: !resource.is_published,
    });
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

        <div className="flex items-center gap-4">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {RESOURCE_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Downloads</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : filteredResources?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No resources found. Create your first resource.
                  </TableCell>
                </TableRow>
              ) : (
                filteredResources?.map((resource) => (
                  <TableRow key={resource.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getFileIcon(resource.file_type)}
                        <span className="font-medium">{resource.title}</span>
                        {resource.is_featured && (
                          <Badge variant="secondary">Featured</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{resource.category}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase text-xs">
                        {resource.file_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {resource.duration || formatFileSize(resource.file_size)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Download className="h-3 w-3 text-muted-foreground" />
                        {resource.download_count}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={resource.is_published ? "default" : "secondary"}>
                        {resource.is_published ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
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
                          asChild
                        >
                          <Link to={`/admin/resources/${resource.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirm(resource)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
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
