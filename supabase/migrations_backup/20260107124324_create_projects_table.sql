-- Create projects/opportunities table for funding opportunities
CREATE TABLE public.projects (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('new', 'open', 'closing-soon', 'closed')),
  deadline DATE NOT NULL,
  funding_amount TEXT NOT NULL,
  location TEXT NOT NULL,
  image_url TEXT,
  requirements TEXT,
  eligibility_criteria TEXT,
  application_fee DECIMAL(10, 2) DEFAULT 0,
  max_applicants INTEGER,
  current_applicants INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_category ON public.projects(category);
CREATE INDEX idx_projects_deadline ON public.projects(deadline);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create policies for projects
-- Everyone can view published projects
CREATE POLICY "Projects are viewable by everyone" 
ON public.projects 
FOR SELECT 
USING (true);

-- Only admins can create projects (check if user has admin role)
CREATE POLICY "Admins can create projects" 
ON public.projects 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND (business_sector = 'admin' OR business_sector = 'Admin')
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users WHERE email LIKE '%@admin.maali.africa'
  )
);

-- Only admins can update projects
CREATE POLICY "Admins can update projects" 
ON public.projects 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND (business_sector = 'admin' OR business_sector = 'Admin')
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users WHERE email LIKE '%@admin.maali.africa'
  )
);

-- Only admins can delete projects
CREATE POLICY "Admins can delete projects" 
ON public.projects 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND (business_sector = 'admin' OR business_sector = 'Admin')
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users WHERE email LIKE '%@admin.maali.africa'
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add foreign key constraint from applications to projects
-- Note: This will only work if applications.project_id is INTEGER (which it is)
ALTER TABLE public.applications 
ADD CONSTRAINT applications_project_id_fkey 
FOREIGN KEY (project_id) 
REFERENCES public.projects(id) 
ON DELETE RESTRICT;

