-- StreamWizard Live (SWIRL-140): sessions get a configurable lifetime and can
-- be renewed, so a stream can run past the 24 hour limit.
--
-- rest-api passes the lifetime (LIVE_SESSION_LIFETIME_S, 60..86400 seconds)
-- to create_live_session, and the phone renews a session before it expires
-- with POST /api/live/sessions/:session_id/renew (renew_live_session). The
-- session is extended in place: same wire id, same secret. The ingest node
-- picks up the new expires_at at its next lookup.
--
-- 86400 is the protocol's upper bound: the ingest node clamps an expiry
-- further ahead and forgets spent session ids after 24 hours. Both
-- functions refuse a lifetime outside 60..86400.

-- create_live_session gets p_lifetime_s. Adding a parameter makes a new
-- signature, so the old one is dropped first; otherwise both would exist and
-- a call without p_lifetime_s would be ambiguous. The default keeps calls
-- that don't pass it working (24 hours, as before). The body is the one from
-- 20261120120000_live_sessions plus the lifetime check and expires_at.
DROP FUNCTION IF EXISTS "public"."create_live_session"(uuid, uuid, text, text, text, text, text, smallint, inet);

CREATE OR REPLACE FUNCTION "public"."create_live_session"(
    "p_user_id" uuid,
    "p_key_id" uuid,
    "p_stream_key" text,
    "p_wire_id" text,
    "p_secret_ciphertext" text,
    "p_secret_iv" text,
    "p_secret_tag" text,
    "p_protocol_version" smallint,
    "p_created_ip" inet DEFAULT NULL,
    "p_lifetime_s" integer DEFAULT 86400
)
RETURNS TABLE ("wire_id" text, "expires_at" timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF p_lifetime_s IS NULL OR p_lifetime_s < 60 OR p_lifetime_s > 86400 THEN
        RAISE EXCEPTION 'p_lifetime_s must be 60..86400 seconds' USING ERRCODE = '22023';
    END IF;

    PERFORM 1
    FROM public.ingest_stream_keys k
    WHERE k.id = p_key_id
      AND k.user_id = p_user_id
      AND k.stream_key = p_stream_key
      AND k.is_active
    FOR UPDATE;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    UPDATE public.live_sessions s
    SET revoked_at = now()
    WHERE s.key_id = p_key_id
      AND s.revoked_at IS NULL
      AND s.ended_at IS NULL;

    RETURN QUERY
    INSERT INTO public.live_sessions AS s
        (wire_id, user_id, key_id, secret_ciphertext, secret_iv, secret_tag, protocol_version, created_ip, expires_at)
    VALUES
        (p_wire_id, p_user_id, p_key_id, p_secret_ciphertext, p_secret_iv, p_secret_tag, p_protocol_version, p_created_ip,
         now() + p_lifetime_s * interval '1 second')
    RETURNING s.wire_id, s.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION "public"."create_live_session"(uuid, uuid, text, text, text, text, text, smallint, inet, integer)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."create_live_session"(uuid, uuid, text, text, text, text, text, smallint, inet, integer)
    TO "service_role";

-- Renews one of the user's live sessions: expires_at becomes now() plus the
-- lifetime, so a session is never more than one lifetime ahead (a shorter
-- lifetime can bring it closer). Only a session that is the user's, not
-- ended, not revoked, not yet expired, and whose key is still the user's
-- active key. Returns no row otherwise, the same for every case. The plan
-- check is rest-api's, as in the node lookup. rest-api (service role) is the
-- only caller.
CREATE OR REPLACE FUNCTION "public"."renew_live_session"(
    "p_wire_id" text,
    "p_user_id" uuid,
    "p_lifetime_s" integer
)
RETURNS TABLE ("wire_id" text, "expires_at" timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF p_lifetime_s IS NULL OR p_lifetime_s < 60 OR p_lifetime_s > 86400 THEN
        RAISE EXCEPTION 'p_lifetime_s must be 60..86400 seconds' USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    UPDATE public.live_sessions AS s
    SET expires_at = now() + p_lifetime_s * interval '1 second'
    FROM public.ingest_stream_keys k
    WHERE s.wire_id = p_wire_id
      AND s.user_id = p_user_id
      AND s.ended_at IS NULL
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND k.id = s.key_id
      AND k.user_id = p_user_id
      AND k.is_active
    RETURNING s.wire_id, s.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION "public"."renew_live_session"(text, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."renew_live_session"(text, uuid, integer) TO "service_role";
