import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X } from 'lucide-react';

interface RubricFormProps {
  initialRubric?: {
    criteria: Array<{
      name: string;
      weight: number;
      max_score: number;
      description?: string;
    }>;
  };
  onSuccess?: () => void;
}

export const RubricForm = ({ initialRubric, onSuccess }: RubricFormProps) => {
  const [criteria, setCriteria] = useState<Array<{
    id: string;
    name: string;
    weight: number;
    max_score: number;
    description?: string;
  }>>(() => {
    const initial = initialRubric?.criteria || [
      { name: '', weight: 0.25, max_score: 10, description: '' },
    ];
    // Add unique IDs to each criterion for stable React keys
    return initial.map((c, idx) => ({
      ...c,
      id: `criterion-${Date.now()}-${idx}`,
    }));
  });
  
  const [versionNotes, setVersionNotes] = useState('');

  const addCriterion = () => {
    setCriteria([...criteria, { 
      id: `criterion-${Date.now()}-${criteria.length}`,
      name: '', 
      weight: 0.25, 
      max_score: 10, 
      description: '' 
    }]);
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
      // Validate criteria before saving
      const validCriteria = criteria.filter(c => c.name.trim() !== '');
      if (validCriteria.length === 0) {
        throw new Error('At least one criterion with a name is required');
      }

      // Normalize weights (only for criteria with names)
      const totalWeight = validCriteria.reduce((sum, c) => sum + c.weight, 0);
      if (totalWeight === 0) {
        throw new Error('Total weight cannot be zero');
      }

      const normalizedCriteria = validCriteria.map(({ id, ...c }) => ({
        name: c.name.trim(),
        weight: c.weight / totalWeight,
        max_score: c.max_score,
        description: c.description?.trim() || '',
      }));

      // Create new rubric version using RPC function
      const { data: versionId, error } = await supabase.rpc(
        'create_rubric_version',
        {
          p_rubric: { criteria: normalizedCriteria },
          p_notes: versionNotes.trim() || null,
        }
      );
      
      if (error) throw error;
      
      return versionId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-rubric'] });
      queryClient.invalidateQueries({ queryKey: ['rubric-versions'] });
      setVersionNotes('');
      toast({ 
        title: 'Rubric Version Created', 
        description: 'A new rubric version has been created. All new reviews will use this version.' 
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error Saving Rubric', 
        description: error.message || 'Failed to save rubric. Please try again.',
        variant: 'destructive'
      });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // Validate that all criteria have names before saving
        const hasValidCriteria = criteria.length > 0 && criteria.every(c => c.name.trim() !== '');
        if (hasValidCriteria) {
          saveRubric.mutate();
        } else {
          toast({ 
            title: 'Validation Error', 
            description: 'Please ensure all criteria have names before saving.',
            variant: 'destructive'
          });
        }
      }}
      className="space-y-4"
    >
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label>Scoring Criteria</Label>
          <Button type="button" variant="outline" size="sm" onClick={addCriterion} disabled={saveRubric.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            Add Criterion
          </Button>
        </div>

        {criteria.map((criterion, index) => (
          <Card key={criterion.id}>
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
                    value={criterion.description || ''}
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

      <div className="space-y-2">
        <Label htmlFor="version-notes">Version Notes (optional)</Label>
        <Textarea
          id="version-notes"
          value={versionNotes}
          onChange={(e) => setVersionNotes(e.target.value)}
          placeholder="Describe what changed in this version (e.g., 'Added sustainability criterion', 'Updated weights')"
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Creating a new version will deactivate all previous versions. Historical reviews will continue using their original rubric versions.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={criteria.length === 0 || saveRubric.isPending}>
        {saveRubric.isPending ? 'Creating Version...' : 'Create New Rubric Version'}
      </Button>
    </form>
  );
};

