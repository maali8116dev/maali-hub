import { useState, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Eye, ClipboardCheck, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAdminProjects, useDeleteProject } from "@/hooks/useAdminProjects";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, SortableColumnHeader } from "@/components/ui/data-table";
import { getProjectApplicationStateLabel } from "@/lib/projectAvailability";
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
import { Briefcase } from "lucide-react";
import { getProjectStatusBadge } from "@/lib/statusBadges";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const AdminProjects = () => {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<number | null>(null);

  const { data: projects = [], isLoading, error, refetch, isFetching } = useAdminProjects();
  const deleteProject = useDeleteProject();

  // Fetch approved applications count per project to check if winners are selected
  const { data: projectsWithWinners = [] } = useQuery({
    queryKey: ["projects-winners-selected"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("project_id")
        .eq("status", "approved")
        .eq("is_draft", false);

      if (error) throw error;

      // Get unique project IDs that have approved applications
      const projectIdsWithWinners = new Set(
        (data || []).map((app) => app.project_id)
      );

      return Array.from(projectIdsWithWinners) as number[];
    },
    staleTime: 1 * 60 * 1000, // Cache for 1 minute
  });


  const handleDelete = (id: number) => {
    setProjectToDelete(id);
    setDeleteDialogOpen(true);
  };

  // Define columns for the projects table
  const projectColumns: ColumnDef<any>[] = useMemo(() => [
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Title" />
      ),
      cell: ({ row }) => {
        return <span className="font-medium">{row.original.title}</span>;
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const project = row.original;
        const hasWinners = projectsWithWinners.includes(project.id);
        return (
          <div className="flex items-center gap-2">
            {getProjectStatusBadge(project.status)}
            {hasWinners && (
              <Badge className="bg-success/10 text-success border-success/20">
                <CheckCircle className="h-3 w-3 mr-1" />
                Winners Selected
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'category',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Category" />
      ),
      cell: ({ row }) => {
        return <Badge variant="outline">{row.original.category}</Badge>;
      },
    },
    {
      accessorKey: 'deadline',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Deadline" />
      ),
      cell: ({ row }) => {
        return (
          <span className="text-sm text-muted-foreground">
            {new Date(row.original.deadline).toLocaleDateString()}
          </span>
        );
      },
      sortingFn: (rowA, rowB) => {
        const dateA = new Date(rowA.original.deadline).getTime();
        const dateB = new Date(rowB.original.deadline).getTime();
        return dateA - dateB;
      },
    },
    {
      id: 'applicationWindow',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Application Window" />
      ),
      cell: ({ row }) => {
        const label = getProjectApplicationStateLabel(row.original.status, row.original.deadline);
        return (
          <Badge variant={label === "Open for applications" ? "default" : "secondary"}>
            {label}
          </Badge>
        );
      },
      sortingFn: (rowA, rowB) => {
        const aLabel = getProjectApplicationStateLabel(rowA.original.status, rowA.original.deadline);
        const bLabel = getProjectApplicationStateLabel(rowB.original.status, rowB.original.deadline);
        return aLabel.localeCompare(bLabel);
      },
    },
    {
      accessorKey: 'currentApplicants',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Applicants" />
      ),
      cell: ({ row }) => {
        return <span>{row.original.currentApplicants}</span>;
      },
    },
    {
      accessorKey: 'fundingAmount',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Funding" />
      ),
      cell: ({ row }) => {
        return <span>{row.original.fundingAmount}</span>;
      },
    },
    {
      accessorKey: 'location',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Location" />
      ),
      cell: ({ row }) => {
        return <span className="text-sm">{row.original.location}</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const project = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/admin/projects/${project.id}`)}
              title="View project"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/admin/projects/${project.id}/applications`)}
              title="View ranked applications"
            >
              <ClipboardCheck className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/admin/projects/${project.id}/edit`)}
              title="Edit project"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => handleDelete(project.id)}
              disabled={deleteProject.isPending}
              title="Delete project"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ], [navigate, deleteProject, handleDelete]);



  const confirmDelete = async () => {
    if (projectToDelete) {
      try {
        await deleteProject.mutateAsync(projectToDelete);
        setDeleteDialogOpen(false);
        setProjectToDelete(null);
      } catch (error) {
        // Error handling is done in the mutation hook
        console.error("Error deleting project:", error);
      }
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Manage Projects</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            Create, edit, and manage funding opportunities
          </p>
        </div>
        <Button 
          onClick={() => navigate("/admin/projects/new")}
          className="w-full sm:w-auto min-h-[44px]"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Project
        </Button>
      </div>

      {/* Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Projects ({projects.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              <p>Error loading projects: {error instanceof Error ? error.message : "Unknown error"}</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium mb-2">No projects found</p>
              <p className="text-sm mb-4">Start by creating your first funding opportunity.</p>
              <Button onClick={() => navigate("/admin/projects/new")}>
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </div>
          ) : (
            <DataTable
              columns={projectColumns}
              data={projects}
              searchPlaceholder="Search by title, category, or location..."
              pageSize={10}
              enableSorting={true}
              enablePagination={true}
              exportFileName="projects"
              onRefresh={() => { refetch(); }}
              isRefreshing={isFetching}
            />
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the project and all associated applications.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground"
              disabled={deleteProject.isPending}
            >
              {deleteProject.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminProjects;

