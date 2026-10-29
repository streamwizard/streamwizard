-- SW-454: a ticket form can ask for files. Discord modals carry a File Upload
-- component, so a bug report can come with its screenshot up front instead of
-- being posted in the channel afterwards (or never).
--
-- A `file` field has no text answer and no row in discord_ticket_answers. The
-- bot re-uploads the files into the ticket's first message, so they reach the
-- transcript (discord_ticket_messages) like any other attachment.
--
-- How many files it takes lives in its own columns: min_length and max_length
-- count characters, and the 4000 they allow means nothing for a file count.
-- Discord fits 10 files in one upload component. Null means "no minimum beyond
-- required" and "Discord's limit", the way the length columns read.

ALTER TABLE "public"."discord_ticket_form_fields"
    DROP CONSTRAINT IF EXISTS "discord_ticket_form_fields_kind_check";

ALTER TABLE "public"."discord_ticket_form_fields"
    ADD CONSTRAINT "discord_ticket_form_fields_kind_check"
    CHECK ("kind" IN ('subject', 'description', 'product', 'text', 'select', 'file'));

ALTER TABLE "public"."discord_ticket_form_fields"
    ADD COLUMN IF NOT EXISTS "min_files" integer,
    ADD COLUMN IF NOT EXISTS "max_files" integer;

ALTER TABLE "public"."discord_ticket_form_fields"
    ADD CONSTRAINT "discord_ticket_form_fields_files_check" CHECK (
        ("min_files" IS NULL OR "min_files" BETWEEN 0 AND 10)
        AND ("max_files" IS NULL OR "max_files" BETWEEN 1 AND 10)
        AND ("min_files" IS NULL OR "max_files" IS NULL OR "min_files" <= "max_files")
    );
