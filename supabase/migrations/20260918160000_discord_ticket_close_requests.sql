-- Two-party close requests and working hours.
--
-- close_mode says who may end a ticket:
--   staff_only  staff close; the opener has no Close button (today's behaviour)
--   request     the opener asks, staff accept or reject; staff can still close
--               straight away. A request nobody answers expires after
--               close_request_hours and the ticket stays open.
--   either      the opener can close their own ticket too, no request needed
--
-- working_hours is when staff are around, so a ticket opened outside them
-- can say when to expect an answer:
--   { "timezone": "Europe/Amsterdam",
--     "days": { "mon": [{ "start": "09:00", "end": "17:00" }], ... } }
-- Empty means no hours are set and the notice is never sent. Parsed and
-- defaulted in code (parseWorkingHours), never by the database.

ALTER TABLE "public"."discord_ticket_settings"
    ADD COLUMN IF NOT EXISTS "close_mode" text NOT NULL DEFAULT 'staff_only',
    ADD COLUMN IF NOT EXISTS "close_request_hours" integer NOT NULL DEFAULT 24,
    ADD COLUMN IF NOT EXISTS "working_hours" jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "public"."discord_ticket_settings"
    ADD CONSTRAINT "discord_ticket_settings_close_mode_check"
    CHECK ("close_mode" IN ('staff_only', 'request', 'either')),
    ADD CONSTRAINT "discord_ticket_settings_close_request_hours_check"
    CHECK ("close_request_hours" BETWEEN 1 AND 8760);

-- One pending request per ticket. Who asked is a Discord user id, kept as a
-- column (not inside detail) so account deletion can blank it.
ALTER TABLE "public"."discord_tickets"
    ADD COLUMN IF NOT EXISTS "close_requested_at" timestamptz,
    ADD COLUMN IF NOT EXISTS "close_requested_by" text,
    ADD COLUMN IF NOT EXISTS "close_request_expires_at" timestamptz;

ALTER TABLE "public"."discord_ticket_events" DROP CONSTRAINT IF EXISTS "discord_ticket_events_type_check";
ALTER TABLE "public"."discord_ticket_events"
    ADD CONSTRAINT "discord_ticket_events_type_check" CHECK ("type" IN (
        'opened', 'claimed', 'unclaimed', 'closed',
        'close_requested', 'close_rejected',
        'close_request_accepted', 'close_request_rejected', 'close_request_expired',
        'member_added', 'member_removed',
        'moved', 'transferred', 'priority_changed', 'renamed', 'topic_edited',
        'stale_warned', 'feedback_submitted', 'tag_replied'
    ));
