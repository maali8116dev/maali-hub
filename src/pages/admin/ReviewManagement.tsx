import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import {
  Users,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import {
  ReviewerCategoriesTab,
  ConflictsTab,
  SettingsTab,
} from './review-management';
import { useCategories } from '@/hooks/useCategories';

const ReviewManagement = () => {

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

  // Get project categories from categories table (cached and optimized)
  const { data: categoriesData = [] } = useCategories();
  const categories = categoriesData.map(c => c.name);

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

export default ReviewManagement;
