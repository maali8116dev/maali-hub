import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useReviewersPerAssignment } from '@/hooks/useReviewersPerAssignment';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RubricsTab } from './RubricsTab';
import { useTranslation } from 'react-i18next';

interface SettingsTabProps {
  sectors: string[];
}

export const SettingsTab = ({ sectors }: SettingsTabProps) => {
  const { t } = useTranslation(['dashboard']);
  const sp = 'admin.reviewManagementPage.settings';
  const { toast } = useToast();
  const { numReviewers, updateNumReviewers } = useReviewersPerAssignment();
  const [localNumReviewers, setLocalNumReviewers] = useState(numReviewers);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    if (localNumReviewers < 1 || localNumReviewers > 10) {
      toast({
        title: t(`${sp}.toast.invalid`),
        description: t(`${sp}.toast.invalidDesc`),
        variant: 'destructive',
      });
      return;
    }
    setIsSaving(true);
    updateNumReviewers(localNumReviewers);
    toast({
      title: t(`${sp}.toast.saved`),
      description: t(`${sp}.toast.savedDesc`, { count: localNumReviewers }),
    });
    // Reset loading state after a brief delay
    setTimeout(() => setIsSaving(false), 500);
  };

  return (
    <div className="space-y-6">
      {/* Review Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t(`${sp}.title`)}</CardTitle>
          <CardDescription>{t(`${sp}.description`)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="num-reviewers">{t(`${sp}.numReviewers`)}</Label>
              <p className="text-sm text-muted-foreground">{t(`${sp}.numReviewersDesc`)}</p>
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
                  {localNumReviewers !== 1 ? t(`${sp}.reviewersPerApp`) : t(`${sp}.reviewerPerApp`)}
                </span>
              </div>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? t(`${sp}.saving`) : t(`${sp}.save`)}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rubrics Section */}
      <RubricsTab sectors={sectors} />
    </div>
  );
};









