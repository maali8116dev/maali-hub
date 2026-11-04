import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from 'react-i18next';

interface AddCategoryFormProps {
  reviewers: any[];
  sectors: string[];
  selectedReviewerId?: string | null;
  onSubmit: (reviewerId: string, sector: string) => void;
  isSubmitting?: boolean;
  onDialogClose?: () => void;
}

export const AddCategoryForm = ({
  reviewers,
  sectors,
  selectedReviewerId,
  onSubmit,
  isSubmitting,
  onDialogClose,
}: AddCategoryFormProps) => {
  const { t } = useTranslation(['dashboard']);
  const af = 'admin.reviewManagementPage.addCategoryForm';
  const [reviewerId, setReviewerId] = useState(selectedReviewerId || '');
  const [sector, setCategory] = useState('');

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
    if (reviewerId && sector && !isSubmitting) {
      onSubmit(reviewerId, sector);
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
          <Label>{t(`${af}.reviewer`)}</Label>
          <div className="px-3 py-2 border rounded-md bg-muted/50">
            <p className="text-sm font-medium">
              {selectedReviewer ? `${selectedReviewer.first_name} ${selectedReviewer.last_name}` : 'Selected Reviewer'}
            </p>
          </div>
        </div>
      ) : (
        // Show reviewer selector if not pre-selected
        <div className="space-y-2">
          <Label>{t(`${af}.reviewer`)}</Label>
          <Select value={reviewerId} onValueChange={setReviewerId}>
            <SelectTrigger>
              <SelectValue placeholder={t(`${af}.selectReviewer`)} />
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
        <Label>{t(`${af}.sector`)}</Label>
        <Select value={sector} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder={t(`${af}.selectSector`)} />
          </SelectTrigger>
          <SelectContent>
            {sectors.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={!reviewerId || !sector || isSubmitting}>
        {isSubmitting ? t(`${af}.adding`) : t(`${af}.addSector`)}
      </Button>
    </form>
  );
};









