
DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at_column()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.update_updated_at_column() SET search_path = public';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('public.is_opportunity_open(integer)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.is_opportunity_open(integer) SET search_path = public';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('public.mark_notification_read(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.mark_notification_read(uuid) SET search_path = public';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('public.generate_sector_slug(text)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.generate_sector_slug(text) SET search_path = public';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('public.claim_email_batch(integer)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.claim_email_batch(integer) SET search_path = public';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('public.generate_category_slug(text)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.generate_category_slug(text) SET search_path = public';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('public.email_queue_updated_at()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.email_queue_updated_at() SET search_path = public';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('public.is_project_open(integer)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.is_project_open(integer) SET search_path = public';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('public.mark_all_notifications_read(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.mark_all_notifications_read(uuid) SET search_path = public';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('public.set_blog_post_published_at()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.set_blog_post_published_at() SET search_path = public';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('public.update_contact_submission_updated_at()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.update_contact_submission_updated_at() SET search_path = public';
  END IF;
END
$$;
