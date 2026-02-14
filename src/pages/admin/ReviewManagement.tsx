import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DataTable, SortableColumnHeader } from '@/components/ui/data-table';
import {
  useReviewerCategories,
} from '@/hooks/useReviewerAssignment';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  FileText,
  AlertTriangle,
  BookOpen,
  TrendingUp,
  Plus,
  X,
  RefreshCw,
  UserCheck,
  UserX,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Settings,
  Eye,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// Hook to manage reviewers per assignment setting
const useReviewersPerAssignment = () => {
  const [numReviewers, setNumReviewers] = useState<number>(3);

  const updateNumReviewers = (value: number) => {
    setNumReviewers(value);
  };

  return { numReviewers, updateNumReviewers };
};

const ReviewManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get all reviewers with details (categories, workload, stats) in a single RPC call
  const { data: reviewers = [] } = useQuery({
    queryKey: ['all-reviewers-with-details'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_reviewers_with_details');
      
      if (error) {
        console.error('Error fetching reviewers with details:', error);
        throw error;
      }
      
      // Transform RPC response to match expected format
      return (data || []).map((r: any) => ({
        user_id: r.reviewer_id,
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email,
        workload: r.workload,
        categories: r.categories || [],
        total_reviews: r.total_reviews,
        average_score: r.average_score,
      }));
    },
  });

  // Get project categories from categories table
  const { data: categories = [] } = useQuery({
    queryKey: ['project-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('name')
        .eq('is_active', true)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(c => c.name);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Review Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage reviewer assignments, categories, rubrics, and conflicts
        </p>
      </div>

      <Tabs defaultValue="reviewers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="reviewers">
            <Users className="h-4 w-4 mr-2" />
            Reviewers
          </TabsTrigger>
          <TabsTrigger value="conflicts">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Conflicts
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Reviewer Categories Tab */}
        <TabsContent value="reviewers" className="space-y-4">
          <ReviewerCategoriesTab reviewers={reviewers} categories={categories} />
        </TabsContent>

        {/* Conflicts Tab */}
        <TabsContent value="conflicts" className="space-y-4">
          <ConflictsTab />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <SettingsTab categories={categories} />
        </TabsContent>
      </Tabs>
    </div>
  );
};


// Reviewers Tab (Combined: Categories + Workload)
const ReviewerCategoriesTab = ({
  reviewers,
  categories,
}: {
  reviewers: any[];
  categories: string[];
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedReviewer, setSelectedReviewer] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  // Extract reviewer categories from reviewers data (already included in RPC response)
  const reviewerCategories = useMemo(() => {
    const allCategories: any[] = [];
    reviewers.forEach((reviewer: any) => {
      if (reviewer.categories && Array.isArray(reviewer.categories)) {
        reviewer.categories.forEach((cat: any) => {
          allCategories.push({
            id: cat.id,
            reviewer_id: reviewer.user_id,
            category_id: cat.category_id,
            category: cat.category_name,
            reviewer: {
              user_id: reviewer.user_id,
              first_name: reviewer.first_name,
              last_name: reviewer.last_name,
            },
          });
        });
      }
    });
    // Sort by category name
    return allCategories.sort((a: any, b: any) => a.category.localeCompare(b.category));
  }, [reviewers]);

  // Refetch function for categories (will refetch reviewers which includes categories)
  const refetchCategories = () => {
    queryClient.invalidateQueries({ queryKey: ['all-reviewers-with-details'] });
  };

  // Transform reviewers data for the table
  const reviewersTableData = useMemo(() => {
    return reviewers.map((reviewer) => {
      const reviewerCats = reviewerCategories.filter(
        (rc: any) => rc.reviewer_id === reviewer.user_id
      );
      const workload = reviewer.workload || 0;
      
      return {
        ...reviewer,
        workload,
        categories: reviewerCats.map((rc: any) => ({
          id: rc.id,
          name: rc.category,
        })),
      };
    });
  }, [reviewers, reviewerCategories]);

  const addCategory = useMutation({
    mutationFn: async ({ reviewerId, category }: { reviewerId: string; category: string }) => {
      // Use RPC function for atomic category assignment
      // This handles validation, duplicate checking, and insertion in one call
      const { data, error } = await supabase.rpc(
        'assign_reviewer_category' as any,
        {
          p_reviewer_id: reviewerId,
          p_category_name: category,
        }
      );
      
      if (error) {
        // RPC function provides clear error messages
        throw new Error(error.message || `Failed to assign category "${category}"`);
      }
      
      // Handle return value - RPC returns array or single object
      const result = Array.isArray(data) ? data : (data ? [data] : []);
      if (result.length === 0) {
        throw new Error(`Failed to assign category "${category}"`);
      }
      
      return result[0];
    },
    onSuccess: async () => {
      // Close dialog and reset form first
      setDialogOpen(false);
      setSelectedReviewer(null);
      
      // Wait a brief moment to ensure database transaction is committed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Invalidate reviewers query (which includes categories and workload)
      await queryClient.invalidateQueries({ queryKey: ['all-reviewers-with-details'] });
      
      // Also explicitly refetch to ensure UI updates
      await refetchCategories();
      
      toast({ title: 'Category Added', description: 'Reviewer category added successfully.' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to add category assignment.',
        variant: 'destructive',
      });
    },
  });

  const removeCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reviewer_categories')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: async () => {
      // Invalidate reviewers query (which includes categories and workload)
      await queryClient.invalidateQueries({ queryKey: ['all-reviewers-with-details'] });
      // Explicitly refetch to ensure UI updates
      await refetchCategories();
      toast({ title: 'Category Removed', description: 'Reviewer category removed.' });
    },
  });

  // Define columns for the reviewers table
  const reviewerColumns: ColumnDef<any>[] = useMemo(() => [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Reviewer" />
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
        <SortableColumnHeader column={column} title="Workload" />
      ),
      cell: ({ row }) => {
        const workload = row.original.workload || 0;
        return (
          <Badge 
            variant={workload > 5 ? 'destructive' : workload > 3 ? 'default' : 'secondary'}
            className="flex items-center gap-1 w-fit"
          >
            <TrendingUp className="h-3 w-3" />
            {workload} active assignment{workload !== 1 ? 's' : ''}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'categories',
      header: 'Categories',
      cell: ({ row }) => {
        const categories = row.original.categories || [];
        return (
          <div className="flex flex-wrap gap-2 max-w-md">
            {categories.length > 0 ? (
              categories.map((cat: any) => (
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
              <span className="text-sm text-muted-foreground">No categories assigned</span>
            )}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
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
              Details
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
              Add Category
            </Button>
          </div>
        );
      },
    },
  ], [navigate, removeCategory, addCategory, setSelectedReviewer, setDialogOpen]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Reviewers</CardTitle>
          <CardDescription>
            Manage reviewer categories and view workload. Reviewers can only review applications in their assigned categories.
          </CardDescription>
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
              {/* <Button disabled={addCategory.isPending || removeCategory.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                Add Category Assignment
              </Button> */}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Reviewer Category</DialogTitle>
              </DialogHeader>
              <AddCategoryForm
                key={formKey}
                reviewers={reviewers}
                categories={categories}
                selectedReviewerId={selectedReviewer}
                onSubmit={(reviewerId, category) =>
                  addCategory.mutate({ reviewerId, category })
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
              searchPlaceholder="Search by reviewer name, category, or workload..."
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

// Add Category Form
const AddCategoryForm = ({
  reviewers,
  categories,
  selectedReviewerId,
  onSubmit,
  isSubmitting,
  onDialogClose,
}: {
  reviewers: any[];
  categories: string[];
  selectedReviewerId?: string | null;
  onSubmit: (reviewerId: string, category: string) => void;
  isSubmitting?: boolean;
  onDialogClose?: () => void;
}) => {
  const [reviewerId, setReviewerId] = useState(selectedReviewerId || '');
  const [category, setCategory] = useState('');

  // Update reviewerId when selectedReviewerId changes
  useEffect(() => {
    if (selectedReviewerId) {
      setReviewerId(selectedReviewerId);
    }
  }, [selectedReviewerId]);

  // Get the selected reviewer's name for display
  const selectedReviewer = reviewers.find(r => r.user_id === reviewerId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reviewerId && category && !isSubmitting) {
      onSubmit(reviewerId, category);
      // Form will reset when dialog closes (via key prop remount)
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      {selectedReviewerId ? (
        // Show reviewer name if pre-selected
        <div className="space-y-2">
          <Label>Reviewer</Label>
          <div className="px-3 py-2 border rounded-md bg-muted/50">
            <p className="text-sm font-medium">
              {selectedReviewer ? `${selectedReviewer.first_name} ${selectedReviewer.last_name}` : 'Selected Reviewer'}
            </p>
          </div>
        </div>
      ) : (
        // Show reviewer selector if not pre-selected
        <div className="space-y-2">
          <Label>Reviewer</Label>
          <Select value={reviewerId} onValueChange={setReviewerId}>
            <SelectTrigger>
              <SelectValue placeholder="Select reviewer" />
            </SelectTrigger>
            <SelectContent>
              {reviewers.map((reviewer) => (
                <SelectItem key={reviewer.user_id} value={reviewer.user_id}>
                  {reviewer.first_name} {reviewer.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={!reviewerId || !category || isSubmitting}>
        {isSubmitting ? 'Adding...' : 'Add Category'}
      </Button>
    </form>
  );
};

// Rubrics Tab
const RubricsTab = ({ categories }: { categories: string[] }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rubrics = [] } = useQuery({
    queryKey: ['all-rubrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('category_rubrics')
        .select(`
          *,
          categories:category_id(name)
        `)
        .order('categories(name)', { ascending: true });
      
      if (error) throw error;
      // Transform to include category name for display
      return (data || []).map((item: any) => ({
        ...item,
        category: item.categories?.name || 'Unknown',
      }));
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category Rubrics</CardTitle>
        <CardDescription>
          Define scoring criteria and weights for each category
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Rubric
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Category Rubric</DialogTitle>
            </DialogHeader>
            <RubricForm categories={categories} />
          </DialogContent>
        </Dialog>

        <div className="mt-6 space-y-4">
          {rubrics.map((rubric: any) => (
            <Card key={rubric.id}>
              <CardHeader>
                <CardTitle>{rubric.category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {rubric.rubric?.criteria?.map((criterion: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-muted rounded">
                      <div>
                        <span className="font-medium capitalize">{criterion.name}</span>
                        {criterion.description && (
                          <span className="text-sm text-muted-foreground ml-2">
                            - {criterion.description}
                          </span>
                        )}
                      </div>
                      <div className="text-sm">
                        Weight: {(criterion.weight * 100).toFixed(0)}% • Max: {criterion.max_score}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Rubric Form
const RubricForm = ({ categories }: { categories: string[] }) => {
  const [category, setCategory] = useState('');
  const [criteria, setCriteria] = useState([
    { name: '', weight: 0.25, max_score: 10, description: '' },
  ]);

  const addCriterion = () => {
    setCriteria([...criteria, { name: '', weight: 0.25, max_score: 10, description: '' }]);
  };

  const updateCriterion = (index: number, field: string, value: any) => {
    const updated = [...criteria];
    updated[index] = { ...updated[index], [field]: value };
    setCriteria(updated);
  };

  const removeCriterion = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const saveRubric = useMutation({
    mutationFn: async () => {
      // Look up category_id from category name
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('name', category)
        .eq('is_active', true)
        .single();
      
      if (categoryError || !categoryData) {
        throw new Error(`Category "${category}" not found`);
      }
      
      // Normalize weights
      const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
      const normalizedCriteria = criteria.map((c) => ({
        ...c,
        weight: c.weight / totalWeight,
      }));

      const { error } = await supabase
        .from('category_rubrics')
        .upsert({
          category_id: categoryData.id,
          rubric: { criteria: normalizedCriteria },
        }, {
          onConflict: 'category_id',
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-rubrics'] });
      toast({ title: 'Rubric Saved', description: 'Category rubric saved successfully.' });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (category && criteria.length > 0) {
          saveRubric.mutate();
        }
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label>Scoring Criteria</Label>
          <Button type="button" variant="outline" size="sm" onClick={addCriterion} disabled={saveRubric.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            Add Criterion
          </Button>
        </div>

        {criteria.map((criterion, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Criterion Name</Label>
                    <Input
                      value={criterion.name}
                      onChange={(e) => updateCriterion(index, 'name', e.target.value)}
                      placeholder="e.g., innovation"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Score</Label>
                    <Input
                      type="number"
                      value={criterion.max_score}
                      onChange={(e) => updateCriterion(index, 'max_score', Number(e.target.value))}
                      min="1"
                      max="10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Weight (0-1)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={criterion.weight}
                    onChange={(e) => updateCriterion(index, 'weight', Number(e.target.value))}
                    min="0"
                    max="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input
                    value={criterion.description}
                    onChange={(e) => updateCriterion(index, 'description', e.target.value)}
                    placeholder="Brief description of this criterion"
                  />
                </div>
                {criteria.length > 1 && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeCriterion(index)}
                    disabled={saveRubric.isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button type="submit" className="w-full" disabled={!category || criteria.length === 0 || saveRubric.isPending}>
        {saveRubric.isPending ? 'Saving...' : 'Save Rubric'}
      </Button>
    </form>
  );
};

// Conflicts Tab
const ConflictsTab = () => {
  const { data: conflicts = [] } = useQuery({
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
        <CardTitle>Conflict of Interest</CardTitle>
        <CardDescription>
          View declared conflicts between reviewers and applications
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={conflictColumns}
          data={conflicts}
          searchPlaceholder="Search by reviewer name, application title, or reason..."
          pageSize={10}
          enableSorting={true}
          enablePagination={true}
          enableExport={true}
          exportFileName="conflicts"
        />
      </CardContent>
    </Card>
  );
};


// Settings Tab
const SettingsTab = ({ categories }: { categories: string[] }) => {
  const { toast } = useToast();
  const { numReviewers, updateNumReviewers } = useReviewersPerAssignment();
  const [localNumReviewers, setLocalNumReviewers] = useState(numReviewers);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    if (localNumReviewers < 1 || localNumReviewers > 10) {
      toast({
        title: 'Invalid Value',
        description: 'Number of reviewers must be between 1 and 10.',
        variant: 'destructive',
      });
      return;
    }
    setIsSaving(true);
    updateNumReviewers(localNumReviewers);
    toast({
      title: 'Settings Saved',
      description: `Number of reviewers per assignment updated to ${localNumReviewers}.`,
    });
    // Reset loading state after a brief delay
    setTimeout(() => setIsSaving(false), 500);
  };

  return (
    <div className="space-y-6">
      {/* Review Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Review Management Settings</CardTitle>
          <CardDescription>
            Configure global settings for the review management system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="num-reviewers">Number of Reviewers per Assignment</Label>
              <p className="text-sm text-muted-foreground">
                All new reviewer assignments will use this number. This ensures consistency across all applications.
              </p>
              <div className="flex items-center gap-4">
                <Input
                  id="num-reviewers"
                  type="number"
                  min="1"
                  max="10"
                  value={localNumReviewers}
                  onChange={(e) => setLocalNumReviewers(parseInt(e.target.value, 10) || 1)}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">
                  reviewer{localNumReviewers !== 1 ? 's' : ''} per application
                </span>
              </div>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rubrics Section */}
      <RubricsTab categories={categories} />
    </div>
  );
};

export default ReviewManagement;

