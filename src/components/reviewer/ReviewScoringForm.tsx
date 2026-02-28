import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { useSubmitReview, useSystemRubric } from '@/hooks/useReviewerAssignment';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { HelpTooltip } from '@/components/ui/help-tooltip';

interface ReviewScoringFormProps {
  applicationId: string;
  assignmentId: string;
  reviewerId: string;
  onSuccess?: () => void;
}

type Recommendation = 'approve' | 'reject' | 'request_info';

const ReviewScoringForm = ({
  applicationId,
  assignmentId,
  reviewerId,
  onSuccess,
}: ReviewScoringFormProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { mutate: submitReview, isPending } = useSubmitReview();
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Persisted reviewer-specific check so disabled state survives page reloads
  const { data: existingReview, isLoading: existingReviewLoading } = useQuery({
    queryKey: ['review-score', applicationId, reviewerId],
    queryFn: async () => {
      if (!applicationId || !reviewerId) {
        return null;
      }

      const { data, error } = await supabase
        .from('review_scores')
        .select('*')
        .eq('application_id', applicationId)
        .eq('reviewer_id', reviewerId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!applicationId && !!reviewerId,
    staleTime: 30 * 1000,
  });

  const hasSubmittedReview = !!existingReview || isSubmitted;

  const normalizeScores = (value: unknown): Record<string, number> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => typeof entryValue === 'number') as Array<[string, number]>;

    return Object.fromEntries(entries);
  };

  const normalizeRecommendation = (value: unknown): Recommendation => {
    if (value === 'approve' || value === 'reject' || value === 'request_info') {
      return value;
    }
    return 'approve';
  };

  // Sync local state with existing review
  useEffect(() => {
    if (existingReview && !isSubmitted) {
      setIsSubmitted(true);
    }
  }, [existingReview, isSubmitted]);

  // Get system rubric (applies to all applications)
  const { data: rubric } = useSystemRubric();

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

  // Initialize scores - use existing review data if available, otherwise use defaults
  useEffect(() => {
    if (existingReview) {
      // Populate form with existing review data
      form.reset({
        scores: normalizeScores(existingReview.scores),
        comments: existingReview.comments || '',
        recommendation: normalizeRecommendation(existingReview.recommendation),
      });
    } else {
      // Initialize with default scores
      const defaultScores: Record<string, number> = {};
      criteria.forEach((criterion: any) => {
        defaultScores[criterion.name] = 5; // Default to middle score
      });
      form.reset({
        scores: defaultScores,
        comments: '',
        recommendation: 'approve',
      });
    }
  }, [criteria, form, existingReview]);

  const onSubmit = (data: any) => {
    // Prevent multiple submissions
    if (existingReviewLoading || hasSubmittedReview || isPending) {
      return;
    }

    setIsSubmitted(true); // Optimistically set as submitted
    submitReview(
      {
        applicationId,
        reviewerId,
        assignmentId,
        scores: data.scores,
        comments: data.comments,
        recommendation: data.recommendation,
        rubricVersionId: rubric?.id, // Pass the active rubric version ID
      },
      {
        onSuccess: async (savedReview) => {
          queryClient.setQueryData(['review-score', applicationId, reviewerId], savedReview);
          await queryClient.invalidateQueries({ queryKey: ['review-score', applicationId, reviewerId] });
          
          toast({
            title: 'Review Submitted',
            description: 'Your review has been submitted successfully.',
          });
          onSuccess?.();
        },
        onError: (error: any) => {
          // Reset submitted state on error
          setIsSubmitted(false);
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
        <div className="flex items-center gap-2">
          <CardTitle>Review Scoring</CardTitle>
          <HelpTooltip 
            content="Score each criterion using the slider or number input. Your scores are weighted according to the rubric. Once submitted, you cannot edit your review."
            side="right"
          />
        </div>
        <CardDescription>
          Score this application based on the criteria below
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Scoring Criteria */}
          <div className="space-y-6">
            {criteria.map((criterion: any) => {
              const currentValue = form.watch(`scores.${criterion.name}`) || 0;
              const maxScore = criterion.max_score || 10;
              
              return (
                <div key={criterion.name} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={criterion.name} className="capitalize">
                        {criterion.name.replace('_', ' ')}
                        {criterion.description && (
                          <span className="text-muted-foreground text-sm font-normal ml-2">
                            ({criterion.description})
                          </span>
                        )}
                      </Label>
                      {criterion.description && (
                        <HelpTooltip 
                          content={criterion.description}
                          side="top"
                        />
                      )}
                    </div>
                    <span className="text-sm font-medium">
                      {currentValue} / {maxScore}
                    </span>
                  </div>
                  
                  {/* Slider and Input Container */}
                  <div className="flex gap-4 items-center">
                    <Slider
                      id={`${criterion.name}-slider`}
                      min={0}
                      max={maxScore}
                      step={0.5}
                      value={[currentValue]}
                      onValueChange={([value]) => {
                        form.setValue(`scores.${criterion.name}`, value, { shouldValidate: true });
                      }}
                      className="flex-1"
                      disabled={hasSubmittedReview}
                    />
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <Input
                        id={`${criterion.name}-input`}
                        type="number"
                        min={0}
                        max={maxScore}
                        step={0.5}
                        value={currentValue}
                        onChange={(e) => {
                          if (!hasSubmittedReview) {
                            const value = parseFloat(e.target.value);
                            if (!isNaN(value)) {
                              const clampedValue = Math.max(0, Math.min(maxScore, value));
                              form.setValue(`scores.${criterion.name}`, clampedValue, { shouldValidate: true });
                            }
                          }
                        }}
                        onBlur={(e) => {
                          if (!hasSubmittedReview) {
                            const value = parseFloat(e.target.value);
                            if (isNaN(value) || value < 0) {
                              form.setValue(`scores.${criterion.name}`, 0, { shouldValidate: true });
                            } else if (value > maxScore) {
                              form.setValue(`scores.${criterion.name}`, maxScore, { shouldValidate: true });
                            }
                          }
                        }}
                        className="w-20 text-center"
                        placeholder="0"
                        disabled={hasSubmittedReview}
                      />
                 
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comments */}
          <div className="space-y-2">
            <Label htmlFor="comments">Comments</Label>
            <Textarea
              id="comments"
              {...form.register('comments')}
              placeholder="Add any additional comments about this application..."
              rows={4}
              disabled={hasSubmittedReview}
            />
          </div>

          {/* Recommendation */}
          <div className="space-y-2">
            <Label htmlFor="recommendation">Recommendation</Label>
            <select
              id="recommendation"
              {...form.register('recommendation')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={hasSubmittedReview}
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
              disabled={existingReviewLoading || hasSubmittedReview || isPending}
            >
              Reset
            </Button>
            <Button type="submit" disabled={existingReviewLoading || hasSubmittedReview || isPending}>
              {isPending ? 'Submitting...' : hasSubmittedReview ? 'Review Submitted' : 'Submit Review'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ReviewScoringForm;

