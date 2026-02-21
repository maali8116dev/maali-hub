import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useReviewersPerAssignment } from '@/hooks/useReviewersPerAssignment';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RubricsTab } from './RubricsTab';

interface SettingsTabProps {
  categories: string[];
}

export const SettingsTab = ({ categories }: SettingsTabProps) => {
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

