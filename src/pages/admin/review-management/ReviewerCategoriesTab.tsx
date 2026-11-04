import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DataTable, SortableColumnHeader } from '@/components/ui/data-table';
import { TrendingUp, Plus, X, Eye } from 'lucide-react';
import { AddCategoryForm } from './AddCategoryForm';
import { useTranslation } from 'react-i18next';

interface ReviewersectorsTabProps {
  reviewers: any[];
  sectors: string[];
}

export const ReviewersectorsTab = ({
  reviewers,
  sectors,
}: ReviewersectorsTabProps) => {
  const { t } = useTranslation(['dashboard']);
  const rp = 'admin.reviewManagementPage.reviewers';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedReviewer, setSelectedReviewer] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  // Extract reviewer sectors from reviewers data (already included in RPC response)
  const reviewersectors = useMemo(() => {
    const allsectors: any[] = [];
    reviewers.forEach((reviewer: any) => {
      if (reviewer.sectors && Array.isArray(reviewer.sectors)) {
        reviewer.sectors.forEach((cat: any) => {
          allsectors.push({
            id: cat.id,
            reviewer_id: reviewer.user_id,
            sector_id: cat.sector_id,
            sector: cat.sector_name,
            reviewer: {
              user_id: reviewer.user_id,
              first_name: reviewer.first_name,
              last_name: reviewer.last_name,
            },
          });
        });
      }
    });
    // Sort by sector name
    return allsectors.sort((a: any, b: any) => a.sector.localeCompare(b.sector));
  }, [reviewers]);

  // Refetch function for sectors (will refetch reviewers which includes sectors)
  const refetchsectors = () => {
    queryClient.invalidateQueries({ queryKey: ['all-reviewers-with-details'] });
  };

  // Transform reviewers data for the table
  const reviewersTableData = useMemo(() => {
    return reviewers.map((reviewer) => {
      const reviewerCats = reviewersectors.filter(
        (rc: any) => rc.reviewer_id === reviewer.user_id
      );
      const workload = reviewer.workload || 0;
      
      return {
        ...reviewer,
        workload,
        sectors: reviewerCats.map((rc: any) => ({
          id: rc.id,
          name: rc.sector,
        })),
      };
    });
  }, [reviewers, reviewersectors]);

  const addCategory = useMutation({
    mutationFn: async ({ reviewerId, sector }: { reviewerId: string; sector: string }) => {
      // Use RPC function for atomic sector assignment
      // This handles validation, duplicate checking, and insertion in one call
      const { data, error } = await supabase.rpc(
        'assign_reviewer_sector' as any,
        {
          p_reviewer_id: reviewerId,
          p_sector_name: sector,
        }
      );
      
      if (error) {
        // RPC function provides clear error messages
        throw new Error(error.message || `Failed to assign sector "${sector}"`);
      }
      
      // Handle return value - RPC returns array or single object
      const result = Array.isArray(data) ? data : (data ? [data] : []);
      if (result.length === 0) {
        throw new Error(`Failed to assign sector "${sector}"`);
      }
      
      return result[0];
    },
    onSuccess: async () => {
      // Close dialog and reset form first
      setDialogOpen(false);
      setSelectedReviewer(null);
      
      // Wait a brief moment to ensure database transaction is committed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Invalidate reviewers query (which includes sectors and workload)
      await queryClient.invalidateQueries({ queryKey: ['all-reviewers-with-details'] });
      
      // Also explicitly refetch to ensure UI updates
      await refetchsectors();
      
      toast({ title: t(`${rp}.toast.sectorAdded`), description: t(`${rp}.toast.sectorAddedDesc`) });
    },
    onError: (error: Error) => {
      toast({ 
        title: t(`${rp}.toast.error`), 
        description: error.message || t('toasts.review.sectorAddFailed', { ns: 'common' }),
        variant: 'destructive',
      });
    },
  });

  const removeCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reviewer_sectors')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: async () => {
      // Invalidate reviewers query (which includes sectors and workload)
      await queryClient.invalidateQueries({ queryKey: ['all-reviewers-with-details'] });
      // Explicitly refetch to ensure UI updates
      await refetchsectors();
      toast({ title: t(`${rp}.toast.sectorRemoved`), description: t(`${rp}.toast.sectorRemovedDesc`) });
    },
  });

  // Define columns for the reviewers table
  const reviewerColumns: ColumnDef<any>[] = useMemo(() => [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title={t(`${rp}.columns.reviewer`)} />
      ),
      cell: ({ row }) => {
        const reviewer = row.original;
        return (
          <div>
            <h3 
              className="font-semibold cursor-pointer hover:underline"
              onClick={() => navigate(`/admin/reviewers/${reviewer.user_id}`)}
            >
              {reviewer.first_name} {reviewer.last_name}
            </h3>
            <p className="text-xs text-muted-foreground">
              ID: {reviewer.user_id.substring(0, 8)}...
            </p>
          </div>
        );
      },
      sortingFn: (rowA, rowB) => {
        const nameA = `${rowA.original.first_name} ${rowA.original.last_name}`;
        const nameB = `${rowB.original.first_name} ${rowB.original.last_name}`;
        return nameA.localeCompare(nameB);
      },
    },
    {
      accessorKey: 'workload',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title={t(`${rp}.columns.workload`)} />
      ),
      cell: ({ row }) => {
        const workload = row.original.workload || 0;
        return (
          <Badge 
            variant={workload > 5 ? 'destructive' : workload > 3 ? 'default' : 'secondary'}
            className="flex items-center gap-1 w-fit"
          >
            <TrendingUp className="h-3 w-3" />
            {workload} {t(`${rp}.workload`, { count: workload })}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'sectors',
      header: t(`${rp}.columns.sectors`),
      cell: ({ row }) => {
        const sectors = row.original.sectors || [];
        return (
          <div className="flex flex-wrap gap-2 max-w-md">
            {sectors.length > 0 ? (
              sectors.map((cat: any) => (
                <Badge key={cat.id} variant="secondary" className="flex items-center gap-1">
                  {cat.name}
                  <X
                    className={`h-3 w-3 ${removeCategory.isPending ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:text-destructive'}`}
                    onClick={() => {
                      if (!removeCategory.isPending) {
                        removeCategory.mutate(cat.id);
                      }
                    }}
                  />
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">{t(`${rp}.noSectors`)}</span>
            )}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: t(`${rp}.columns.actions`),
      cell: ({ row }) => {
        const reviewer = row.original;
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/admin/reviewers/${reviewer.user_id}`)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {t(`${rp}.details`)}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedReviewer(reviewer.user_id);
                setDialogOpen(true);
              }}
              disabled={addCategory.isPending || removeCategory.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t(`${rp}.addSector`)}
            </Button>
          </div>
        );
      },
    },
  ], [navigate, removeCategory, addCategory, setSelectedReviewer, setDialogOpen, t]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t(`${rp}.title`)}</CardTitle>
          <CardDescription>{t(`${rp}.description`)}</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (open) {
              // Increment form key to reset form when dialog opens
              setFormKey(prev => prev + 1);
            } else {
              // Reset form when dialog closes
              setSelectedReviewer(null);
            }
          }}>
            <DialogTrigger asChild>
              {/* Hidden trigger - buttons in table handle opening */}
              <div style={{ display: 'none' }} />
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('admin.reviewManagementPage.reviewers.addSectorDialog')}</DialogTitle>
              </DialogHeader>
              <AddCategoryForm
                key={formKey}
                reviewers={reviewers}
                sectors={sectors}
                selectedReviewerId={selectedReviewer}
                onSubmit={(reviewerId, sector) =>
                  addCategory.mutate({ reviewerId, sector })
                }
                isSubmitting={addCategory.isPending}
                onDialogClose={() => setDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>

          <div className="mt-6">
            <DataTable
              columns={reviewerColumns}
              data={reviewersTableData}
              searchPlaceholder={t(`${rp}.searchPlaceholder`)}
              pageSize={10}
              enableSorting={true}
              enablePagination={true}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};









