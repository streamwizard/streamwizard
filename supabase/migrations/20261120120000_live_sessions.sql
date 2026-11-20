-- StreamWizard Live (SWIRL-46): one row per bonded-protocol session the
-- phone app opens with POST /api/live/sessions.
--
-- rest-api creates the row after it has checked the stream key (active,
-- owned by the caller, owner holds a cloud_obs plan) and hands the phone the
-- wire id and the session secret. The ingest node looks the session up by
-- wire id (GET /api/ingest-nodes/live-sessions/:session_id) and gets the same
-- secret back, so both ends derive the same keys. The secret is stored
-- encrypted (AES-256-GCM, TOKEN_ENCRYPTION_KEY, @repo/supabase/crypto).
--
-- A session stops being returned once it expires, is ended by its owner, or
-- is revoked: by a newer session for the same key, or by the key being
-- rotated or turned off (trigger below).
--
-- Service-role only: RLS on, no policies, nothing granted to anon or
-- authenticated. The table holds session secrets.

CREATE TABLE IF NOT EXISTS "public"."live_sessions" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    -- The 64-bit session id on the wire, as 16 lowercase hex characters.
    "wire_id" text NOT NULL,
    "user_id" uuid NOT NULL,
    "key_id" uuid NOT NULL,
    "secret_ciphertext" text NOT NULL,
    "secret_iv" text NOT NULL,
    "secret_tag" text NOT NULL,
    "protocol_version" smallint NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "expires_at" timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
    "ended_at" timestamptz,
    "revoked_at" timestamptz,
    "created_ip" inet,
    CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "live_sessions_wire_id_key" UNIQUE ("wire_id"),
    CONSTRAINT "live_sessions_wire_id_check"
        CHECK ("wire_id" ~ '^[0-9a-f]{16}$' AND "wire_id" <> '0000000000000000'),
    CONSTRAINT "live_sessions_protocol_version_check" CHECK ("protocol_version" >= 1),
    CONSTRAINT "live_sessions_expires_at_check" CHECK ("expires_at" > "created_at"),
    CONSTRAINT "live_sessions_user_id_fkey" FOREIGN KEY ("user_id")
        REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    CONSTRAINT "live_sessions_key_id_fkey" FOREIGN KEY ("key_id")
        REFERENCES "public"."ingest_stream_keys"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."live_sessions" OWNER TO "postgres";

-- Backs the user foreign key (account deletes).
CREATE INDEX IF NOT EXISTS "live_sessions_user_id_idx"
    ON "public"."live_sessions" USING btree ("user_id");
-- Backs the key foreign key, and the "revoke this key's open sessions" updates.
CREATE INDEX IF NOT EXISTS "live_sessions_key_id_idx"
    ON "public"."live_sessions" USING btree ("key_id");

ALTER TABLE "public"."live_sessions" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."live_sessions" FROM anon, authenticated;
GRANT ALL ON TABLE "public"."live_sessions" TO "service_role";

-- Opens a session for a stream key: locks the key row, checks it is still the
-- same active key of the same user, revokes the key's open sessions and
-- inserts the new one, in one transaction. Locking the key serializes
-- concurrent creates for one key, so at most one session per key stays open,
-- and a rotation that lands between rest-api's key check and this call is
-- seen here. Returns no row when the key changed or went inactive meanwhile.
-- rest-api (service role) is the only caller.
CREATE OR REPLACE FUNCTION "public"."create_live_session"(
    "p_user_id" uuid,
    "p_key_id" uuid,
    "p_stream_key" text,
    "p_wire_id" text,
    "p_secret_ciphertext" text,
    "p_secret_iv" text,
    "p_secret_tag" text,
    "p_protocol_version" smallint,
    "p_created_ip" inet DEFAULT NULL
)
RETURNS TABLE ("wire_id" text, "expires_at" timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
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
        (wire_id, user_id, key_id, secret_ciphertext, secret_iv, secret_tag, protocol_version, created_ip)
    VALUES
        (p_wire_id, p_user_id, p_key_id, p_secret_ciphertext, p_secret_iv, p_secret_tag, p_protocol_version, p_created_ip)
    RETURNING s.wire_id, s.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION "public"."create_live_session"(uuid, uuid, text, text, text, text, text, smallint, inet)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."create_live_session"(uuid, uuid, text, text, text, text, text, smallint, inet)
    TO "service_role";

-- A rotated or deactivated stream key revokes its open live sessions, so an
-- ingest node stops accepting them on the next lookup. Deactivation covers a
-- lost plan too (the plan sweep turns the owner's keys off). Security definer
-- because live_sessions is service-role only and a key may be changed by
-- another role; the function only touches the changed key's sessions.
CREATE OR REPLACE FUNCTION "public"."revoke_live_sessions_for_key"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.live_sessions s
    SET revoked_at = now()
    WHERE s.key_id = NEW.id
      AND s.revoked_at IS NULL
      AND s.ended_at IS NULL;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION "public"."revoke_live_sessions_for_key"() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS "ingest_stream_keys_revoke_live_sessions" ON "public"."ingest_stream_keys";
CREATE TRIGGER "ingest_stream_keys_revoke_live_sessions"
    AFTER UPDATE OF "stream_key", "is_active" ON "public"."ingest_stream_keys"
    FOR EACH ROW
    WHEN (NEW."stream_key" IS DISTINCT FROM OLD."stream_key" OR (OLD."is_active" AND NOT NEW."is_active"))
    EXECUTE FUNCTION "public"."revoke_live_sessions_for_key"();
