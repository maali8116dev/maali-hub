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
import { Plus } from 'lucide-react';
import { RubricForm } from './RubricForm';

interface RubricsTabProps {
  categories: string[];
}

export const RubricsTab = ({ categories }: RubricsTabProps) => {
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

