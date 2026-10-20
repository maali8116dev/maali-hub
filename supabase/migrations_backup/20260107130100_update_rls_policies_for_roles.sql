-- Update RLS policies to use the new role enum instead of business_sector

-- Drop existing admin policies for projects
DROP POLICY IF EXISTS "Admins can create projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can update projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;

-- Recreate policies using role enum
CREATE POLICY "Admins can create projects" 
ON public.projects 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users WHERE email LIKE '%@admin.maali.africa'
  )
);

CREATE POLICY "Admins can update projects" 
ON public.projects 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users WHERE email LIKE '%@admin.maali.africa'
  )
);

CREATE POLICY "Admins can delete projects" 
ON public.projects 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users WHERE email LIKE '%@admin.maali.africa'
  )
);

-- Drop existing admin policies for blog_posts
DROP POLICY IF EXISTS "Published blog posts are viewable by everyone" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can create blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can update blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can delete blog posts" ON public.blog_posts;

-- Recreate policies using role enum
CREATE POLICY "Published blog posts are viewable by everyone" 
ON public.blog_posts 
FOR SELECT 
USING (status = 'published' OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users WHERE email LIKE '%@admin.maali.africa'
  )
);

CREATE POLICY "Admins can create blog posts" 
ON public.blog_posts 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users WHERE email LIKE '%@admin.maali.africa'
  )
);

CREATE POLICY "Admins can update blog posts" 
ON public.blog_posts 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users WHERE email LIKE '%@admin.maali.africa'
  )
);

CREATE POLICY "Admins can delete blog posts" 
ON public.blog_posts 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
  OR auth.uid() IN (
    SELECT id FROM auth.users WHERE email LIKE '%@admin.maali.africa'
  )
);

