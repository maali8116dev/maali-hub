
ALTER FUNCTION public.update_opportunities_updated_at() SET search_path = public;
ALTER FUNCTION public.is_opportunity_open(integer) SET search_path = public;
ALTER FUNCTION public.mark_notification_read(uuid) SET search_path = public;
ALTER FUNCTION public.generate_sector_slug(text) SET search_path = public;
ALTER FUNCTION public.claim_email_batch(integer) SET search_path = public;
ALTER FUNCTION public.generate_category_slug(text) SET search_path = public;
ALTER FUNCTION public.email_queue_updated_at() SET search_path = public;
ALTER FUNCTION public.is_project_open(integer) SET search_path = public;
ALTER FUNCTION public.mark_all_notifications_read(uuid) SET search_path = public;
ALTER FUNCTION public.set_blog_post_published_at() SET search_path = public;
ALTER FUNCTION public.update_contact_submission_updated_at() SET search_path = public;
