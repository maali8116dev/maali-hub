-- ============================================
-- Contact Form Submissions Table
-- ============================================
-- Stores contact form submissions from the public contact page
-- ============================================

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  country TEXT,
  subject TEXT NOT NULL CHECK (subject IN (
    'funding',
    'application',
    'partnership',
    'technical',
    'general'
  )),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new',
    'read',
    'replied',
    'archived'
  )),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Optional: link to user if they're logged in
  admin_notes TEXT, -- Internal notes for admins
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON public.contact_submissions(email);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON public.contact_submissions(status);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_subject ON public.contact_submissions(subject);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON public.contact_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_user_id ON public.contact_submissions(user_id);

-- Enable Row Level Security
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Anyone can create contact submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Users can view their own submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Admins can update submissions" ON public.contact_submissions;

-- RLS Policies
-- Anyone (including anonymous users) can create contact submissions
CREATE POLICY "Anyone can create contact submissions"
ON public.contact_submissions
FOR INSERT
WITH CHECK (true);

-- Users can view their own submissions (if logged in)
CREATE POLICY "Users can view their own submissions"
ON public.contact_submissions
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
    )
  )
);

-- Admins can view all submissions
CREATE POLICY "Admins can view all submissions"
ON public.contact_submissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND p.role = 'admin'
  )
);

-- Admins can update submissions (for status, notes, etc.)
CREATE POLICY "Admins can update submissions"
ON public.contact_submissions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
    AND p.role = 'admin'
  )
);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_contact_submission_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_contact_submission_updated_at ON public.contact_submissions;

CREATE TRIGGER trigger_update_contact_submission_updated_at
  BEFORE UPDATE ON public.contact_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contact_submission_updated_at();

COMMENT ON TABLE public.contact_submissions IS 'Stores contact form submissions from the public contact page. Accessible to all users for creation, viewable by admins and the submitting user.';

