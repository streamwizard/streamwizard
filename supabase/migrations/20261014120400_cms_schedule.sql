-- CMS, part 5: scheduling, and retrying cache refreshes that didn't land.
--
-- Scheduling is web-admin's (cms_schedule, cms_unschedule); going live at the
-- time is the rest-api scheduler's (cms_claim_due_scheduled, part 3). Same
-- error prefixes as the other CMS functions.
--
-- cms_revalidate_queue replaces cms_content.revalidate_tags: every write to
-- cms_content bumps updated_at, so parking tags on the post would mark a live
-- post as having unpublished changes. A queue row also covers refreshes that
-- belong to no post (an author or a topic was renamed).

DROP INDEX IF EXISTS public.cms_content_revalidate_idx;
ALTER TABLE public.cms_content DROP COLUMN IF EXISTS revalidate_tags;

-- Cache tags web-streamwizard didn't confirm (POST /api/revalidate failed).
-- The rest-api scheduler claims due rows, retries them with backoff and
-- deletes them once the site answers. Rows are worth nothing after the
-- site's own hourly refresh, so the scheduler drops them past that.
CREATE TABLE public.cms_revalidate_queue (
  id bigint GENERATED ALWAYS AS IDENTITY,
  tags text[] NOT NULL,
  -- 'immediate': the old copy must never be served again (it came off the site).
  mode text NOT NULL DEFAULT 'immediate',
  -- Paths to tell IndexNow about once the refresh lands.
  index_now_paths text[] NOT NULL DEFAULT '{}',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cms_revalidate_queue_pkey PRIMARY KEY (id),
  CONSTRAINT cms_revalidate_queue_tags_check CHECK (cardinality(tags) BETWEEN 1 AND 200),
  CONSTRAINT cms_revalidate_queue_mode_check CHECK (mode IN ('stale', 'immediate')),
  CONSTRAINT cms_revalidate_queue_paths_check CHECK (cardinality(index_now_paths) <= 20)
);
CREATE INDEX cms_revalidate_queue_due_idx ON public.cms_revalidate_queue (next_attempt_at);

ALTER TABLE public.cms_revalidate_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cms_revalidate_queue FROM anon, authenticated;
GRANT ALL ON public.cms_revalidate_queue TO service_role;

-- Up to p_limit due rows, leased for p_lease_seconds so a second scheduler
-- (or a slow tick) can't send the same refresh twice.
CREATE OR REPLACE FUNCTION public.cms_claim_revalidations(p_limit integer, p_lease_seconds integer)
RETURNS SETOF public.cms_revalidate_queue
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE cms_revalidate_queue q
  SET attempts = q.attempts + 1, next_attempt_at = now() + make_interval(secs => p_lease_seconds)
  WHERE q.id IN (
    SELECT id FROM cms_revalidate_queue
    WHERE next_attempt_at <= now()
    ORDER BY next_attempt_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING q.*;
$$;

-- Schedule a draft (or move a scheduled post to a new time). The scheduler
-- publishes it on p_actor's behalf. Returns { lock_version, publish_at }.
CREATE OR REPLACE FUNCTION public.cms_schedule(
  p_content_id uuid,
  p_actor uuid,
  p_expected_lock_version integer,
  p_publish_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c cms_content;
  v_lock integer;
BEGIN
  c := cms_lock_content(p_content_id, p_expected_lock_version);
  IF c.status NOT IN ('draft', 'scheduled') THEN
    RAISE EXCEPTION 'cms_invalid: a % post can''t be scheduled', c.status;
  END IF;
  IF p_publish_at IS NULL OR p_publish_at <= now() THEN
    RAISE EXCEPTION 'cms_invalid: the publish time has to be in the future';
  END IF;

  UPDATE cms_content SET
    status = 'scheduled',
    publish_at = p_publish_at,
    scheduled_by = p_actor,
    schedule_error = NULL,
    lock_version = lock_version + 1,
    updated_by = coalesce(p_actor, updated_by)
  WHERE id = c.id
  RETURNING lock_version INTO v_lock;

  RETURN jsonb_build_object('lock_version', v_lock, 'publish_at', p_publish_at);
END;
$$;

-- Back to a draft, schedule dropped. Returns { lock_version }.
CREATE OR REPLACE FUNCTION public.cms_unschedule(p_content_id uuid, p_actor uuid, p_expected_lock_version integer)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c cms_content;
  v_lock integer;
BEGIN
  c := cms_lock_content(p_content_id, p_expected_lock_version);
  IF c.status <> 'scheduled' THEN
    RAISE EXCEPTION 'cms_invalid: a % post isn''t scheduled', c.status;
  END IF;

  UPDATE cms_content SET
    status = 'draft',
    publish_at = NULL,
    scheduled_by = NULL,
    lock_version = lock_version + 1,
    updated_by = coalesce(p_actor, updated_by)
  WHERE id = c.id
  RETURNING lock_version INTO v_lock;

  RETURN jsonb_build_object('lock_version', v_lock);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cms_claim_revalidations(integer, integer) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cms_schedule(uuid, uuid, integer, timestamptz) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cms_unschedule(uuid, uuid, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cms_claim_revalidations(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cms_schedule(uuid, uuid, integer, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.cms_unschedule(uuid, uuid, integer) TO service_role;
