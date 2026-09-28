-- Proxmox backup monitoring (docs/backup-monitoring-plan.md).
--
-- rest-api polls PBS + the PVE hosts into backup_poll_state and stores the
-- Proxmox notification webhooks in backup_events. Only data for our PBS
-- namespace ever lands here; events for other jobs are dropped before insert.

-- One row per datastore/namespace. `data` is BackupPollData from
-- @repo/backups. claimed_at is the overlap guard: a replica only polls after
-- a conditional update on it succeeds, so two rest-api replicas never both
-- hit PBS in the same interval.
CREATE TABLE IF NOT EXISTS "public"."backup_poll_state" (
    "id" text PRIMARY KEY,
    "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "claimed_at" timestamptz,
    "claimed_by" text,
    "polled_at" timestamptz,
    "updated_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "public"."backup_poll_state" OWNER TO "postgres";

-- Webhook audit trail. dedupe_key makes redelivery a no-op; ordering always
-- uses occurred_at (the Proxmox timestamp), never arrival order.
CREATE TABLE IF NOT EXISTS "public"."backup_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "source" text NOT NULL,
    "event_type" text NOT NULL,
    "job_id" text,
    "severity" text NOT NULL,
    "title" text NOT NULL,
    "message" text NOT NULL DEFAULT '',
    "fields" jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- Parsed per-guest rows for vzdump events; NULL when the text didn't parse.
    "guests" jsonb,
    -- False while job discovery hasn't confirmed the job belongs to us yet.
    "matched" boolean NOT NULL DEFAULT true,
    "occurred_at" timestamptz NOT NULL,
    "received_at" timestamptz NOT NULL DEFAULT now(),
    "dedupe_key" text NOT NULL UNIQUE
);

ALTER TABLE "public"."backup_events" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "backup_events_occurred_at_idx" ON "public"."backup_events" ("occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "backup_events_source_occurred_at_idx" ON "public"."backup_events" ("source", "occurred_at" DESC);

-- RLS: rest-api writes as service_role; admins may read for web-admin.
ALTER TABLE "public"."backup_poll_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."backup_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read backup poll state" ON "public"."backup_poll_state"
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT public.check_user_role('admin') ) );

CREATE POLICY "Admins read backup events" ON "public"."backup_events"
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT public.check_user_role('admin') ) );

GRANT ALL ON TABLE "public"."backup_poll_state" TO "service_role";
GRANT ALL ON TABLE "public"."backup_events" TO "service_role";
GRANT SELECT ON TABLE "public"."backup_poll_state" TO "authenticated";
GRANT SELECT ON TABLE "public"."backup_events" TO "authenticated";

-- 180-day retention for the event history.
CREATE OR REPLACE FUNCTION "public"."purge_backup_events"() RETURNS void
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = ''
    AS $$
        DELETE FROM public.backup_events WHERE received_at < now() - interval '180 days';
    $$;

ALTER FUNCTION "public"."purge_backup_events"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."purge_backup_events"() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "extensions";

SELECT cron.schedule(
    'purge-backup-events',
    '17 4 * * *',
    $$ SELECT public.purge_backup_events(); $$
);
