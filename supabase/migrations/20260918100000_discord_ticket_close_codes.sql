-- Tickets: the GitHub integration is gone, and every close now says why.
--
-- 1. GitHub sync removed. The "Move to GitHub" button, the issues webhook and
--    the sweep-ticket-deletions Edge Function no longer exist, so the cron job
--    that called the function and the grace-period column go with them.
--    github_issue_number / github_issue_url stay as read-only history: old
--    tickets keep their issue link in the dashboard, nothing writes them.
--
--    Before this runs against a remote project, check for rows where
--    scheduled_deletion_at IS NOT NULL. Those channels were waiting for the
--    sweep and have to be deleted by hand; nothing else will remove them.
--
-- 2. close_code + close_reason. A ticket can end without anyone clicking
--    Close (its channel was deleted, the opener left, it went stale), so the
--    closer is nullable in practice and the code carries the why.
--
-- 3. The GitHub path closed tickets without stamping closed_at, which also
--    kept them out of purge_old_discord_ticket_transcripts() forever. Backfill
--    from updated_at, the moment the webhook flipped the status.
--
-- 4. Timeline events grow a target (who was added, who it was transferred to)
--    and a detail blob (from/to category, old/new priority). Target ids live in
--    their own columns, never inside detail, so delete_user_data() can
--    anonymise by column. The type list covers the lifecycle actions the bot
--    is about to get; listing them now saves a migration per feature.

-- 1 ---------------------------------------------------------------------------

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron')
       AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-ticket-deletions') THEN
        PERFORM cron.unschedule('sweep-ticket-deletions');
    END IF;
END
$$;

DROP INDEX IF EXISTS "public"."discord_tickets_pending_deletion_idx";
ALTER TABLE "public"."discord_tickets" DROP COLUMN IF EXISTS "scheduled_deletion_at";

-- 2 ---------------------------------------------------------------------------

ALTER TABLE "public"."discord_tickets"
    ADD COLUMN IF NOT EXISTS "close_code" text,
    ADD COLUMN IF NOT EXISTS "close_reason" text;

ALTER TABLE "public"."discord_tickets"
    ADD CONSTRAINT "discord_tickets_close_code_check"
    CHECK ("close_code" IS NULL OR "close_code" IN ('manual', 'inactivity', 'member_left', 'channel_deleted', 'force'));

ALTER TABLE "public"."discord_tickets"
    ADD CONSTRAINT "discord_tickets_close_reason_length_check"
    CHECK ("close_reason" IS NULL OR char_length("close_reason") <= 1000);

-- 3 ---------------------------------------------------------------------------

UPDATE "public"."discord_tickets"
SET "closed_at" = "updated_at"
WHERE "status" = 'closed' AND "closed_at" IS NULL;

UPDATE "public"."discord_tickets"
SET "close_code" = 'manual'
WHERE "status" = 'closed' AND "close_code" IS NULL;

-- 4 ---------------------------------------------------------------------------

ALTER TABLE "public"."discord_ticket_events"
    ADD COLUMN IF NOT EXISTS "target_discord_id" text,
    ADD COLUMN IF NOT EXISTS "target_name" text,
    ADD COLUMN IF NOT EXISTS "detail" jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "public"."discord_ticket_events" DROP CONSTRAINT IF EXISTS "discord_ticket_events_type_check";
ALTER TABLE "public"."discord_ticket_events"
    ADD CONSTRAINT "discord_ticket_events_type_check" CHECK ("type" IN (
        'opened', 'claimed', 'unclaimed', 'closed',
        'close_requested', 'close_rejected',
        'member_added', 'member_removed',
        'moved', 'transferred', 'priority_changed', 'renamed', 'topic_edited',
        'stale_warned', 'feedback_submitted', 'tag_replied'
    ));
