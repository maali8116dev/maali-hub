import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Save, X, Tag } from "lucide-react";
import {
  useAllSectors,
  useCreateSector,
  useUpdateSector,
  useDeleteSector,
  useToggleSectorStatus,
  Sector,
} from "@/hooks/useSectors";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const sectorSchema = z.object({
  name: z.string().min(1, "Name is required").min(2, "Name must be at least 2 characters"),
  slug: z.string().optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
});

type SectorFormValues = z.infer<typeof sectorSchema>;

const Sectors = () => {
  const { data: sectors = [], isLoading } = useAllSectors();
  const createSector = useCreateSector();
  const updateSector = useUpdateSector();
  const deleteSector = useDeleteSector();
  const toggleStatus = useToggleSectorStatus();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Sector | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Sector | null>(null);

  const form = useForm<SectorFormValues>({
    resolver: zodResolver(sectorSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      is_active: true,
    },
  });

  const handleCreate = async (data: SectorFormValues) => {
    try {
      await createSector.mutateAsync({
        name: data.name,
        slug: data.slug,
        description: data.description,
        is_active: data.is_active,
      });
      setIsCreateDialogOpen(false);
      form.reset();
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleEdit = (sector: Sector) => {
    setEditingCategory(sector);
    form.reset({
      name: sector.name,
      slug: sector.slug,
      description: sector.description || "",
      is_active: sector.is_active,
    });
  };

  const handleUpdate = async (data: SectorFormValues) => {
    if (!editingCategory) return;

    try {
      await updateSector.mutateAsync({
        id: editingCategory.id,
        data,
      });
      setEditingCategory(null);
      form.reset();
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;

    try {
      await deleteSector.mutateAsync(deletingCategory.id);
      setDeletingCategory(null);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleToggleStatus = async (sector: Sector) => {
    await toggleStatus.mutateAsync({
      id: sector.id,
      isActive: !sector.is_active,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">sectors</h1>
          <p className="text-muted-foreground mt-2">Manage project sectors</p>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">sectors</h1>
          <p className="text-muted-foreground mt-2">
            Manage project sectors and their display settings
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Sector
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Sector</DialogTitle>
              <DialogDescription>
                Add a new sector for projects. The slug will be auto-generated if not provided.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="e.g., Technology"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="slug">Slug (optional)</Label>
                <Input
                  id="slug"
                  {...form.register("slug")}
                  placeholder="e.g., technology (auto-generated if empty)"
                />
              </div>
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  placeholder="Brief description of this sector"
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={form.watch("is_active") ?? true}
                  onCheckedChange={(checked) => form.setValue("is_active", checked)}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createSector.isPending}>
                  {createSector.isPending ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {sectors.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No sectors"
          description="Get started by creating your first sector"
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All sectors</CardTitle>
            <CardDescription>
              {sectors.length} sector{sectors.length !== 1 ? "ies" : ""} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sectors.map((sector) => (
                <div
                  key={sector.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{sector.name}</h3>
                      {!sector.is_active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    {sector.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {sector.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Slug: {sector.slug}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={sector.is_active}
                      onCheckedChange={() => handleToggleStatus(sector)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(sector)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingCategory(sector)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      {editingCategory && (
        <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Sector</DialogTitle>
              <DialogDescription>
                Update sector details. Changes will affect all projects using this sector.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  {...form.register("name")}
                  placeholder="e.g., Technology"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="edit-slug">Slug</Label>
                <Input
                  id="edit-slug"
                  {...form.register("slug")}
                  placeholder="e.g., technology"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  {...form.register("description")}
                  placeholder="Brief description of this sector"
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-is_active"
                  checked={form.watch("is_active") ?? true}
                  onCheckedChange={(checked) => form.setValue("is_active", checked)}
                />
                <Label htmlFor="edit-is_active">Active</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingCategory(null);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateSector.isPending}>
                  {updateSector.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingCategory}
        onOpenChange={(open) => !open && setDeletingCategory(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sector</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingCategory?.name}"? This action cannot be
              undone. Make sure no projects are using this sector before deleting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Sectors;









