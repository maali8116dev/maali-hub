import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, TrendingUp, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { DataTable, SortableColumnHeader } from '@/components/ui/data-table';

export const ReviewerDetails = () => {
  const { reviewerId } = useParams<{ reviewerId: string }>();
  const navigate = useNavigate();

  // Debug: Log the reviewerId
  console.log('ReviewerDetails - reviewerId from params:', reviewerId);
  
  // Also try to get it from the URL directly as fallback
  useEffect(() => {
    if (!reviewerId) {
      const pathParts = window.location.pathname.split('/');
      const reviewerIndex = pathParts.indexOf('reviewers');
      if (reviewerIndex !== -1 && pathParts[reviewerIndex + 1]) {
        console.log('Found reviewerId from URL path:', pathParts[reviewerIndex + 1]);
      }
    }
  }, [reviewerId]);

  // Fetch reviewer profile
  const { data: reviewer, isLoading: isLoadingReviewer, error: reviewerError } = useQuery({
    queryKey: ['reviewer-profile', reviewerId],
    queryFn: async () => {
      if (!reviewerId) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, role')
        .eq('user_id', reviewerId)
        .single();
      
      if (error) {
        console.error('Error fetching reviewer profile:', error);
        throw error;
      }
      
      if (!data) {
        throw new Error('Reviewer not found');
      }
      
      return data;
    },
    enabled: !!reviewerId,
  });

  // Fetch all reviews for this reviewer with application and project info
  const { data: reviews = [], isLoading: isLoadingReviews } = useQuery({
    queryKey: ['reviewer-reviews', reviewerId],
    queryFn: async () => {
      if (!reviewerId) return [];
      
      // Fetch completed reviews
      const { data: completedReviews, error: reviewsError } = await supabase
        .from('review_scores')
        .select(`
          id,
          application_id,
          scores,
          overall_score,
          comments,
          recommendation,
          submitted_at,
          created_at,
          updated_at,
          application:applications!application_id(
            id,
            project_title,
            status,
            project_id,
            project:projects!project_id(
              id,
              title,
              category_id,
              category:categories!category_id(name)
            )
          )
        `)
        .eq('reviewer_id', reviewerId);
      
      if (reviewsError) throw reviewsError;
      
      // Fetch pending assignments (where no review_scores exist yet)
      const { data: assignments, error: assignmentsError } = await supabase
        .from('application_assignments')
        .select(`
          id,
          application_id,
          assigned_at,
          status,
          application:applications!application_id(
            id,
            project_title,
            status,
            project_id,
            project:projects!project_id(
              id,
              title,
              category_id,
              category:categories!category_id(name)
            )
          )
        `)
        .eq('reviewer_id', reviewerId)
        .in('status', ['pending', 'in_progress']);
      
      if (assignmentsError) throw assignmentsError;
      
      // Filter out assignments that already have reviews
      const assignmentIdsWithReviews = new Set((completedReviews || []).map((r: any) => r.application_id));
      const pendingAssignments = (assignments || []).filter((a: any) => !assignmentIdsWithReviews.has(a.application_id));
      
      // Combine: completed reviews + pending assignments
      // Format pending assignments to match review structure
      const formattedPending = pendingAssignments.map((assignment: any) => ({
        id: assignment.id,
        application_id: assignment.application_id,
        scores: null,
        overall_score: null,
        comments: null,
        recommendation: null,
        submitted_at: null,
        created_at: assignment.assigned_at,
        updated_at: assignment.assigned_at,
        status: assignment.status, // 'pending' or 'in_progress'
        application: assignment.application,
      }));
      
      // Format completed reviews
      const formattedCompleted = (completedReviews || []).map((review: any) => ({
        ...review,
        status: 'completed',
      }));
      
      // Combine and sort: pending first, then completed by submitted_at
      const combined = [...formattedPending, ...formattedCompleted].sort((a, b) => {
        // Pending/in_progress first
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        // Then by submitted_at or created_at descending
        const dateA = a.submitted_at || a.created_at || '';
        const dateB = b.submitted_at || b.created_at || '';
        return dateB.localeCompare(dateA);
      });
      
      return combined;
    },
    enabled: !!reviewerId,
  });

  // Fetch workload
  const { data: workload = 0, isLoading: isLoadingWorkload } = useQuery({
    queryKey: ['reviewer-workload', reviewerId],
    queryFn: async () => {
      if (!reviewerId) return 0;
      const { data, error } = await supabase.rpc('get_reviewer_workload', {
        p_reviewer_id: reviewerId,
      });
      if (error) {
        console.warn('Error fetching workload:', error);
        return 0;
      }
      return data || 0;
    },
    enabled: !!reviewerId,
  });

  // Fetch assigned categories
  const { data: categories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['reviewer-categories', reviewerId],
    queryFn: async () => {
      if (!reviewerId) return [];
      const { data, error } = await supabase
        .from('reviewer_categories')
        .select(`
          *,
          category:categories!category_id(name)
        `)
        .eq('reviewer_id', reviewerId);
      if (error) {
        console.warn('Error fetching categories:', error);
        return [];
      }
      return (data || []).map((item: any) => item.category?.name || 'Unknown');
    },
    enabled: !!reviewerId,
  });

  // Calculate stats (only for completed reviews)
  const completedReviews = reviews.filter((r: any) => r.status === 'completed');
  const stats = {
    totalReviews: completedReviews.length,
    totalAssignments: reviews.length, // Includes pending + completed
    workload,
    averageScore: completedReviews.length > 0
      ? completedReviews.reduce((sum: number, r: any) => sum + (parseFloat(r.overall_score) || 0), 0) / completedReviews.length
      : 0,
    recommendations: {
      approve: completedReviews.filter((r: any) => r.recommendation === 'approve').length,
      reject: completedReviews.filter((r: any) => r.recommendation === 'reject').length,
      request_info: completedReviews.filter((r: any) => r.recommendation === 'request_info').length,
    },
  };

  // Define columns for the reviews table
  const reviewColumns: ColumnDef<any>[] = useMemo(() => [
    {
      accessorKey: 'application.id',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Application" />
      ),
      cell: ({ row }) => {
        const app = row.original.application;
        return (
          <span className="font-mono text-xs">
            {app?.id ? `${app.id.substring(0, 8)}...` : 'N/A'}
          </span>
        );
      },
      sortingFn: (rowA, rowB) => {
        const idA = rowA.original.application?.id || '';
        const idB = rowB.original.application?.id || '';
        return idA.localeCompare(idB);
      },
    },
    {
      accessorKey: 'application.project_title',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Project Title" />
      ),
      cell: ({ row }) => {
        const app = row.original.application;
        const project = app?.project;
        return (
          <span className="font-medium">
            {app?.project_title || project?.title || 'N/A'}
          </span>
        );
      },
    },
    {
      accessorKey: 'category',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Category" />
      ),
      cell: ({ row }) => {
        const project = row.original.application?.project;
        const categoryName = project?.category?.name || 'N/A';
        return (
          <Badge variant="outline">
            {categoryName}
          </Badge>
        );
      },
      sortingFn: (rowA, rowB) => {
        const catA = rowA.original.application?.project?.category?.name || '';
        const catB = rowB.original.application?.project?.category?.name || '';
        return catA.localeCompare(catB);
      },
    },
    {
      accessorKey: 'scores',
      header: 'Scores',
      cell: ({ row }) => {
        const scores = row.original.scores || {};
        return (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {Object.keys(scores).length > 0 ? (
              Object.entries(scores).map(([key, value]: [string, any]) => (
                <Badge key={key} variant="secondary" className="text-xs">
                  {key}: {value}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">No scores</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'overall_score',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Overall" />
      ),
      cell: ({ row }) => {
        const score = row.original.overall_score;
        return score ? (
          <Badge variant={parseFloat(score) >= 7 ? 'default' : 'secondary'}>
            {parseFloat(score).toFixed(1)}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">N/A</span>
        );
      },
      sortingFn: (rowA, rowB) => {
        const scoreA = parseFloat(rowA.original.overall_score) || 0;
        const scoreB = parseFloat(rowB.original.overall_score) || 0;
        return scoreA - scoreB;
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.original.status;
        if (status === 'completed') {
          return <Badge variant="default">Completed</Badge>;
        } else if (status === 'in_progress') {
          return <Badge variant="secondary">In Progress</Badge>;
        } else if (status === 'pending') {
          return <Badge variant="outline">Pending</Badge>;
        }
        return <Badge variant="outline">Unknown</Badge>;
      },
    },
    {
      accessorKey: 'recommendation',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Recommendation" />
      ),
      cell: ({ row }) => {
        const status = row.original.status;
        const recommendation = row.original.recommendation;
        
        // Show status badge for pending/in_progress assignments
        if (status !== 'completed') {
          return (
            <Badge variant="outline">
              {status === 'pending' ? 'Pending Review' : 'In Progress'}
            </Badge>
          );
        }
        
        // Show recommendation for completed reviews
        return recommendation ? (
          <Badge
            variant={
              recommendation === 'approve'
                ? 'default'
                : recommendation === 'reject'
                ? 'destructive'
                : 'secondary'
            }
          >
            {recommendation}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">N/A</span>
        );
      },
    },
    {
      accessorKey: 'submitted_at',
      header: ({ column }) => (
        <SortableColumnHeader column={column} title="Submitted / Assigned" />
      ),
      cell: ({ row }) => {
        const status = row.original.status;
        const submittedAt = row.original.submitted_at;
        const createdAt = row.original.created_at;
        
        // For pending/in_progress, show assigned_at (created_at)
        // For completed, show submitted_at
        const dateToShow = status === 'completed' ? submittedAt : createdAt;
        
        return (
          <span className="text-sm text-muted-foreground">
            {dateToShow
              ? new Date(dateToShow).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : 'Not submitted'}
          </span>
        );
      },
      sortingFn: (rowA, rowB) => {
        const dateA = rowA.original.submitted_at ? new Date(rowA.original.submitted_at).getTime() : 0;
        const dateB = rowB.original.submitted_at ? new Date(rowB.original.submitted_at).getTime() : 0;
        return dateA - dateB;
      },
    },
  ], []);

  if (isLoadingReviewer) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (reviewerError || (!isLoadingReviewer && !reviewer)) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin/review-management')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Reviewers
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              {reviewerError 
                ? `Error loading reviewer: ${reviewerError instanceof Error ? reviewerError.message : 'Unknown error'}`
                : 'Reviewer not found'}
            </p>
            {reviewerId && (
              <p className="text-xs text-muted-foreground mt-2">
                Reviewer ID: {reviewerId}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/admin/review-management')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Reviewers
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {reviewer.first_name} {reviewer.last_name}
          </h1>
          <p className="text-muted-foreground">Reviewer Details</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReviews}</div>
            <p className="text-xs text-muted-foreground">Submitted reviews</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Workload</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.workload}</div>
            <p className="text-xs text-muted-foreground">Active assignments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.averageScore.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">Out of 10</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned Categories</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
            <div className="flex flex-wrap gap-1 mt-2">
              {isLoadingCategories ? (
                <Skeleton className="h-5 w-20" />
              ) : categories.length > 0 ? (
                categories.slice(0, 3).map((cat: string) => (
                  <Badge key={cat} variant="secondary" className="text-xs">
                    {cat}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">None</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendation Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Recommendation Distribution</CardTitle>
          <CardDescription>
            Breakdown of review recommendations submitted by this reviewer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <span className="text-2xl font-bold">{stats.recommendations.approve}</span>
                <span className="text-sm text-muted-foreground ml-2">Approve</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <span className="text-2xl font-bold">{stats.recommendations.reject}</span>
                <span className="text-sm text-muted-foreground ml-2">Reject</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div>
                <span className="text-2xl font-bold">{stats.recommendations.request_info}</span>
                <span className="text-sm text-muted-foreground ml-2">Request Info</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviews Datatable */}
      <Card>
        <CardHeader>
          <CardTitle>Review History</CardTitle>
          <CardDescription>
            All reviews and pending assignments for this reviewer
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingReviews ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <DataTable
              columns={reviewColumns}
              data={reviews}
              searchPlaceholder="Search by project title, category, or recommendation..."
              pageSize={10}
              enableSorting={true}
              enablePagination={true}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

