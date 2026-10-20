-- Fix the set_blog_post_published_at function by adding a fixed search_path
CREATE OR REPLACE FUNCTION public.set_blog_post_published_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'published' AND OLD.status != 'published' THEN
    NEW.published_at = now();
  END IF;
  RETURN NEW;
END;
$function$;