-- Add review tracking fields to applications table
-- This allows tracking who reviewed (approved/rejected) applications and when
-- Uses a single reviewed_by column since status already indicates approved/rejected

ALTER TABLE public.applications
  ADD COLUMN
IF NOT EXISTS reviewed_by UUID REFERENCES auth.users
(id),
ADD COLUMN
IF NOT EXISTS reviewed_at TIMESTAMP
WITH TIME ZONE,
ADD COLUMN
IF NOT EXISTS review_notes TEXT;

-- Create indexes for efficient querying
CREATE INDEX
IF NOT EXISTS idx_applications_reviewed_by ON public.applications
(reviewed_by);
CREATE INDEX
IF NOT EXISTS idx_applications_reviewed_at ON public.applications
(reviewed_at);

-- Comments
COMMENT ON COLUMN public.applications.reviewed_by IS 'User ID of the reviewer/admin who reviewed this application (approved or rejected)';
COMMENT ON COLUMN public.applications.reviewed_at IS 'Timestamp when the application was reviewed (approved or rejected)';
COMMENT ON COLUMN public.applications.review_notes IS 'Notes from the reviewer about the approval/rejection decision';

