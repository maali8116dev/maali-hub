import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAdminProjects, useDeleteProject } from "@/hooks/useAdminProjects";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
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
import { Briefcase, Languages } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import {
  triggerOpportunityTranslation,
  invalidateOpportunityTranslationQueries,
  translationFailureMessage,
} from "@/hooks/useTranslateOpportunity";
import { useQueryClient } from "@tanstack/react-query";
import { createOpportunityColumns, OPPORTUNITY_TABLE_HIDDEN_COLUMNS } from "@/components/opportunities/createOpportunityColumns";

const AdminProjects = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation(["dashboard", "common"]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<number | null>(null);
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);

  const { data: opportunities = [], isLoading, error, refetch, isFetching } = useAdminProjects();
  const deleteProject = useDeleteProject();

  const { data: opportunitiesWithWinners = [] } = useQuery({
    queryKey: ["opportunities-winners-selected"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("opportunity_id")
        .eq("status", "approved")
        .eq("is_draft", false);

      if (error) throw error;

      const opportunityIdsWithWinners = new Set(
        (data || []).map((app: { opportunity_id: number }) => app.opportunity_id),
      );

      return Array.from(opportunityIdsWithWinners) as number[];
    },
    staleTime: 1 * 60 * 1000,
  });

  const handleDelete = (id: number) => {
    setProjectToDelete(id);
    setDeleteDialogOpen(true);
  };

  const projectColumns = useMemo(
    () =>
      createOpportunityColumns({
        role: "admin",
        t,
        language: i18n.language,
        opportunitiesWithWinners,
        navigate,
        onDelete: handleDelete,
        deletePending: deleteProject.isPending,
      }),
    [t, i18n.language, opportunitiesWithWinners, navigate, deleteProject.isPending],
  );

  const handleTranslateAll = async () => {
    if (!opportunities.length || isTranslatingAll) return;
    setIsTranslatingAll(true);
    let failed = 0;
    let firstFailureReason: string | null = null;
    try {
      for (const opportunity of opportunities) {
        const result = await triggerOpportunityTranslation(opportunity.id);
        if (!result.ok) {
          failed += 1;
          if (!firstFailureReason) firstFailureReason = result.reason;
        }
      }
      invalidateOpportunityTranslationQueries(queryClient);
      await refetch();
      if (failed === 0) {
        toast({
          title: t("admin.opportunitiesPage.translateAllDone"),
          description: t("admin.opportunitiesPage.translateAllDoneDesc", {
            count: opportunities.length,
          }),
        });
      } else {
        toast({
          title: t("admin.opportunitiesPage.translateAllPartial"),
          description: firstFailureReason
            ? `${t("admin.opportunitiesPage.translateAllPartialDesc", {
                failed,
                total: opportunities.length,
              })} ${translationFailureMessage(firstFailureReason)}`
            : t("admin.opportunitiesPage.translateAllPartialDesc", {
                failed,
                total: opportunities.length,
              }),
          variant: "destructive",
        });
      }
    } finally {
      setIsTranslatingAll(false);
    }
  };

  const confirmDelete = async () => {
    if (projectToDelete) {
      try {
        await deleteProject.mutateAsync(projectToDelete);
        setDeleteDialogOpen(false);
        setProjectToDelete(null);
      } catch (error) {
        console.error("Error deleting project:", error);
      }
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t("admin.opportunitiesPage.title")}</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
            {t("admin.opportunitiesPage.subtitle")}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {import.meta.env.DEV && (
            <Button
              type="button"
              variant="outline"
              onClick={handleTranslateAll}
              disabled={isTranslatingAll || opportunities.length === 0}
              className="w-full sm:w-auto min-h-[44px]"
            >
              <Languages className="h-4 w-4 mr-2" />
              {isTranslatingAll
                ? t("admin.opportunitiesPage.translatingAll")
                : t("admin.opportunitiesPage.translateAll")}
            </Button>
          )}
          <Button
            onClick={() => navigate("/admin/opportunities/new")}
            className="w-full sm:w-auto min-h-[44px]"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("admin.opportunitiesPage.create")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.opportunitiesPage.allOpportunities", { count: opportunities.length })}</CardTitle>
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
              <p>{t("admin.opportunitiesPage.loadError", { message: error instanceof Error ? error.message : "Unknown error" })}</p>
            </div>
          ) : opportunities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium mb-2">{t("admin.opportunitiesPage.empty.title")}</p>
              <p className="text-sm mb-4">{t("admin.opportunitiesPage.empty.description")}</p>
              <Button onClick={() => navigate("/admin/opportunities/new")}>
                <Plus className="h-4 w-4 mr-2" />
                {t("admin.opportunitiesPage.create")}
              </Button>
            </div>
          ) : (
            <DataTable
              columns={projectColumns}
              data={opportunities}
              searchPlaceholder={t("opportunities.table.searchPlaceholder")}
              pageSize={10}
              enableSorting={true}
              enablePagination={true}
              enableColumnVisibility
              initialColumnVisibility={OPPORTUNITY_TABLE_HIDDEN_COLUMNS}
              embedded
              exportFileName="opportunities"
              onRefresh={() => { refetch(); }}
              isRefreshing={isFetching}
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.opportunitiesPage.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.opportunitiesPage.deleteDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.opportunitiesPage.deleteDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground"
              disabled={deleteProject.isPending}
            >
              {deleteProject.isPending ? t("admin.opportunitiesPage.deleteDialog.deleting") : t("admin.opportunitiesPage.deleteDialog.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminProjects;
