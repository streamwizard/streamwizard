-- Media library: check quota and insert the pending row in one step.
--
-- createAssetUpload used to read usage, compare, then insert. Parallel uploads
-- could all pass the check before any pending row existed and overshoot the
-- quota together. This function takes a per-user advisory lock for the length
-- of the transaction, so reservations for one user run one at a time.
--
-- The quota itself is still worked out in TypeScript (plan limits) and passed
-- in. Returns false when the upload doesn't fit; nothing is inserted then.

CREATE OR REPLACE FUNCTION public.reserve_user_asset(
  p_user_id uuid,
  p_id uuid,
  p_key text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_kind text,
  p_quota_bytes bigint,
  p_reservation_cutoff timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  used bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('user_assets:' || p_user_id::text, 0));

  SELECT COALESCE((SELECT used_bytes FROM user_storage_usage WHERE user_id = p_user_id), 0)
       + COALESCE((
           SELECT sum(size_bytes) FROM user_assets
           WHERE user_id = p_user_id AND status = 'pending' AND created_at >= p_reservation_cutoff
         ), 0)
    INTO used;

  IF used + p_size_bytes > p_quota_bytes THEN
    RETURN false;
  END IF;

  INSERT INTO user_assets (id, user_id, key, file_name, mime_type, size_bytes, kind, status)
  VALUES (p_id, p_user_id, p_key, p_file_name, p_mime_type, p_size_bytes, p_kind, 'pending');

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_user_asset(uuid, uuid, text, text, text, bigint, text, bigint, timestamptz)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_user_asset(uuid, uuid, text, text, text, bigint, text, bigint, timestamptz)
  TO service_role;
