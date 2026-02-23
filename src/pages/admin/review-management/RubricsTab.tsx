import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Edit } from 'lucide-react';
import { RubricForm } from './RubricForm';

interface RubricsTabProps {
  categories?: string[]; // Kept for backward compatibility but not used
}

export const RubricsTab = ({ categories }: RubricsTabProps) => {
  const { data: rubric } = useQuery({
    queryKey: ['system-rubric'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_rubric')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Rubric</CardTitle>
        <CardDescription>
          Define scoring criteria and weights that apply to all applications
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rubric ? (
          <>
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Rubric
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Edit System Rubric</DialogTitle>
                </DialogHeader>
                <div className="overflow-y-auto flex-1 pr-2 -mr-2">
                  <RubricForm 
                    initialRubric={rubric.rubric as any} 
                    onSuccess={() => setIsEditDialogOpen(false)}
                  />
                </div>
              </DialogContent>
            </Dialog>

            <div className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Current Rubric Criteria</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(rubric.rubric as any)?.criteria?.map((criterion: any, idx: number) => (
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
            </div>
          </>
        ) : (
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create System Rubric
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Create System Rubric</DialogTitle>
              </DialogHeader>
              <div className="overflow-y-auto flex-1 pr-2 -mr-2">
                <RubricForm />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
};

