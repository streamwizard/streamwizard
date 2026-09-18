-- Which StreamWizard product a ticket is about, picked in the ticket modal.
-- Plain text (not an enum) so the list in @repo/supabase/queries/tickets.ts
-- can change without a migration. NULL for tickets opened before this.
ALTER TABLE "public"."discord_tickets"
    ADD COLUMN IF NOT EXISTS "product" text;
