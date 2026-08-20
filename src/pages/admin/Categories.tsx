import { useState, useMemo } from "react";
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
import { useTranslation } from "react-i18next";

type SectorFormValues = {
  name: string;
  slug?: string;
  description?: string;
  is_active?: boolean;
};

const Sectors = () => {
  const { t, i18n } = useTranslation(["dashboard"]);
  const sectorSchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .min(1, t("admin.sectorsPage.form.nameRequired"))
          .min(2, t("admin.sectorsPage.form.nameMin")),
        slug: z.string().optional(),
        description: z.string().optional(),
        is_active: z.boolean().optional(),
      }),
    [t, i18n.language]
  );

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
          <h1 className="text-3xl font-bold">{t("admin.sectorsPage.title")}</h1>
          <p className="text-muted-foreground mt-2">{t("admin.sectorsPage.subtitleLoading")}</p>
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
          <h1 className="text-3xl font-bold">{t("admin.sectorsPage.title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("admin.sectorsPage.subtitle")}
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("admin.sectorsPage.addSector")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.sectorsPage.create.title")}</DialogTitle>
              <DialogDescription>
                {t("admin.sectorsPage.create.description")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
              <div>
                <Label htmlFor="name">{t("admin.sectorsPage.form.name")} *</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder={t("admin.sectorsPage.form.namePlaceholder")}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="slug">{t("admin.sectorsPage.form.slugOptional")}</Label>
                <Input
                  id="slug"
                  {...form.register("slug")}
                  placeholder={t("admin.sectorsPage.form.slugPlaceholder")}
                />
              </div>
              <div>
                <Label htmlFor="description">{t("admin.sectorsPage.form.descriptionOptional")}</Label>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  placeholder={t("admin.sectorsPage.form.descriptionPlaceholder")}
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={form.watch("is_active") ?? true}
                  onCheckedChange={(checked) => form.setValue("is_active", checked)}
                />
                <Label htmlFor="is_active">{t("admin.sectorsPage.form.active")}</Label>
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
                  {t("admin.sectorsPage.form.cancel")}
                </Button>
                <Button type="submit" disabled={createSector.isPending}>
                  {createSector.isPending ? t("admin.sectorsPage.create.creating") : t("admin.sectorsPage.create.submit")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {sectors.length === 0 ? (
        <EmptyState
          icon={Tag}
          title={t("admin.sectorsPage.empty.title")}
          description={t("admin.sectorsPage.empty.description")}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.sectorsPage.list.title")}</CardTitle>
            <CardDescription>
              {t("admin.sectorsPage.list.count", { count: sectors.length })}
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
                        <Badge variant="secondary">{t("admin.sectorsPage.list.inactive")}</Badge>
                      )}
                    </div>
                    {sector.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {sector.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{t("admin.sectorsPage.list.slug", { slug: sector.slug })}</span>
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
              <DialogTitle>{t("admin.sectorsPage.edit.title")}</DialogTitle>
              <DialogDescription>
                {t("admin.sectorsPage.edit.description")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">{t("admin.sectorsPage.form.name")} *</Label>
                <Input
                  id="edit-name"
                  {...form.register("name")}
                  placeholder={t("admin.sectorsPage.form.namePlaceholder")}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="edit-slug">{t("admin.sectorsPage.form.slug")}</Label>
                <Input
                  id="edit-slug"
                  {...form.register("slug")}
                  placeholder={t("admin.sectorsPage.form.slugEditPlaceholder")}
                />
              </div>
              <div>
                <Label htmlFor="edit-description">{t("admin.sectorsPage.form.description")}</Label>
                <Textarea
                  id="edit-description"
                  {...form.register("description")}
                  placeholder={t("admin.sectorsPage.form.descriptionPlaceholder")}
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-is_active"
                  checked={form.watch("is_active") ?? true}
                  onCheckedChange={(checked) => form.setValue("is_active", checked)}
                />
                <Label htmlFor="edit-is_active">{t("admin.sectorsPage.form.active")}</Label>
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
                  {t("admin.sectorsPage.form.cancel")}
                </Button>
                <Button type="submit" disabled={updateSector.isPending}>
                  {updateSector.isPending ? t("admin.sectorsPage.edit.saving") : t("admin.sectorsPage.edit.submit")}
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
            <AlertDialogTitle>{t("admin.sectorsPage.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.sectorsPage.delete.description", { name: deletingCategory?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.sectorsPage.delete.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("admin.sectorsPage.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Sectors;









