import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useSubmitReview, useCategoryRubric } from '@/hooks/useReviewerAssignment';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ReviewScoringFormProps {
  applicationId: string;
  assignmentId: string;
  reviewerId: string;
  onSuccess?: () => void;
}

const ReviewScoringForm = ({
  applicationId,
  assignmentId,
  reviewerId,
  onSuccess,
}: ReviewScoringFormProps) => {
  const { toast } = useToast();
  const { mutate: submitReview, isPending } = useSubmitReview();

  // Get project category to load appropriate rubric
  const { data: application } = useQuery({
    queryKey: ['application', applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('applications')
        .select(`
          project_id,
          projects!inner(
            id,
            category_id,
            categories:category_id(name)
          )
        `)
        .eq('id', applicationId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!applicationId,
  });

  const category = application?.projects?.categories?.name || application?.projects?.category || '';
  const { data: rubric } = useCategoryRubric(category);

  // Build schema dynamically based on rubric
  const buildSchema = () => {
    if (rubric?.rubric?.criteria) {
      const schemaFields: Record<string, z.ZodNumber> = {};
      rubric.rubric.criteria.forEach((criterion: any) => {
        schemaFields[criterion.name] = z
          .number()
          .min(0)
          .max(criterion.max_score || 10);
      });
      return z.object({
        scores: z.object(schemaFields),
        comments: z.string().optional(),
        recommendation: z.enum(['approve', 'reject', 'request_info']),
      });
    }
    // Default schema if no rubric
    return z.object({
      scores: z.object({
        innovation: z.number().min(0).max(10),
        feasibility: z.number().min(0).max(10),
        impact: z.number().min(0).max(10),
        team: z.number().min(0).max(10),
      }),
      comments: z.string().optional(),
      recommendation: z.enum(['approve', 'reject', 'request_info']),
    });
  };

  const form = useForm({
    resolver: zodResolver(buildSchema()),
    defaultValues: {
      scores: {} as Record<string, number>,
      comments: '',
      recommendation: 'approve' as 'approve' | 'reject' | 'request_info',
    },
  });

  const criteria = rubric?.rubric?.criteria || [
    { name: 'innovation', weight: 0.25, max_score: 10, description: 'Innovation and creativity' },
    { name: 'feasibility', weight: 0.25, max_score: 10, description: 'Feasibility and implementation plan' },
    { name: 'impact', weight: 0.25, max_score: 10, description: 'Potential impact and benefits' },
    { name: 'team', weight: 0.25, max_score: 10, description: 'Team capability and experience' },
  ];

  // Initialize default scores
  useEffect(() => {
    const defaultScores: Record<string, number> = {};
    criteria.forEach((criterion: any) => {
      defaultScores[criterion.name] = 5; // Default to middle score
    });
    form.reset({
      scores: defaultScores,
      comments: '',
      recommendation: 'approve',
    });
  }, [criteria, form]);

  const onSubmit = (data: any) => {
    submitReview(
      {
        applicationId,
        reviewerId,
        assignmentId,
        scores: data.scores,
        comments: data.comments,
        recommendation: data.recommendation,
      },
      {
        onSuccess: () => {
          toast({
            title: 'Review Submitted',
            description: 'Your review has been submitted successfully.',
          });
          onSuccess?.();
        },
        onError: (error: any) => {
          toast({
            title: 'Submission Failed',
            description: error.message || 'Failed to submit review. Please try again.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Scoring</CardTitle>
        <CardDescription>
          Score this application based on the criteria below
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Scoring Criteria */}
          <div className="space-y-6">
            {criteria.map((criterion: any) => (
              <div key={criterion.name} className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor={criterion.name} className="capitalize">
                    {criterion.name.replace('_', ' ')}
                    {criterion.description && (
                      <span className="text-muted-foreground text-sm font-normal ml-2">
                        ({criterion.description})
                      </span>
                    )}
                  </Label>
                  <span className="text-sm font-medium">
                    {form.watch(`scores.${criterion.name}`) || 0} / {criterion.max_score}
                  </span>
                </div>
                <Slider
                  id={criterion.name}
                  min={0}
                  max={criterion.max_score || 10}
                  step={0.5}
                  value={[form.watch(`scores.${criterion.name}`) || 0]}
                  onValueChange={([value]) => {
                    form.setValue(`scores.${criterion.name}`, value);
                  }}
                  className="w-full"
                />
              </div>
            ))}
          </div>

          {/* Comments */}
          <div className="space-y-2">
            <Label htmlFor="comments">Comments</Label>
            <Textarea
              id="comments"
              {...form.register('comments')}
              placeholder="Add any additional comments about this application..."
              rows={4}
            />
          </div>

          {/* Recommendation */}
          <div className="space-y-2">
            <Label htmlFor="recommendation">Recommendation</Label>
            <select
              id="recommendation"
              {...form.register('recommendation')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="approve">Approve</option>
              <option value="reject">Reject</option>
              <option value="request_info">Request More Information</option>
            </select>
          </div>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
            >
              Reset
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Submitting...' : 'Submit Review'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ReviewScoringForm;

