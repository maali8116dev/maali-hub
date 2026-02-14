-- Return application + related project + linked/unlinked documents in one call.
-- Replaces 2-4 separate client queries with a single RPC round-trip.
CREATE OR REPLACE FUNCTION public.get_application_details(
  p_application_id UUID
)
RETURNS TABLE (
  application JSONB,
  project JSONB,
  documents JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app   public.applications%ROWTYPE;
  v_role  TEXT;
BEGIN
  -- 1. Authenticate
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 2. Fetch the application (single PK lookup, reused below)
  SELECT *
  INTO v_app
  FROM public.applications
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found.';
  END IF;

  -- 3. Authorise
  v_role := public.get_user_role(auth.uid());

  IF v_app.user_id <> auth.uid()
     AND COALESCE(v_role, '') NOT IN ('admin', 'reviewer')
  THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

  -- 4. Return application + project + documents in one go.
  --    Re-uses v_app via the WHERE clause on the same PK (single index hit).
  RETURN QUERY
  SELECT
    to_jsonb(a.*) AS application,

    CASE
      WHEN p.id IS NULL THEN NULL
      ELSE to_jsonb(p.*) || jsonb_build_object(
             'category', COALESCE(c.name, 'Uncategorized')
           )
    END AS project,

    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(d.*) ORDER BY d.created_at DESC)
        FROM (
          -- Linked documents
          SELECT ad.*
          FROM public.application_documents ad
          WHERE ad.application_id = a.id

          UNION  -- UNION deduplicates automatically

          -- Unlinked fallback: same user+project, no application link
          SELECT ad.*
          FROM public.application_documents ad
          WHERE ad.user_id      = a.user_id
            AND ad.project_id   = a.project_id
            AND ad.application_id IS NULL
        ) d
      ),
      '[]'::jsonb
    ) AS documents

  FROM public.applications a
  LEFT JOIN public.projects   p ON p.id = a.project_id
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE a.id = p_application_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_application_details(UUID) TO authenticated;

-- Optional: speed up the unlinked-docs fallback at scale.
CREATE INDEX IF NOT EXISTS idx_app_docs_unlinked
  ON public.application_documents (user_id, project_id)
  WHERE application_id IS NULL;
