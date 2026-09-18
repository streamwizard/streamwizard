-- The web-admin ticket page follows a ticket live through Supabase Realtime
-- instead of polling or waiting for the bot's websocket push. Realtime only
-- delivers rows the subscriber may SELECT, so admins need a read policy on
-- discord_tickets like the one the history tables already have. The bot's
-- service-role client keeps writing as before.

CREATE POLICY "Admins read discord tickets" ON "public"."discord_tickets"
    AS PERMISSIVE FOR SELECT TO "authenticated"
    USING ( ( SELECT "public"."check_user_role"('admin') ) );

GRANT SELECT ON TABLE "public"."discord_tickets" TO "authenticated";

-- INSERT and UPDATE only reach the page: messages are soft-deleted (an
-- UPDATE), members are followed through their member_added/member_removed
-- events, so discord_ticket_members stays out of the publication.
ALTER PUBLICATION "supabase_realtime" ADD TABLE
    "public"."discord_tickets",
    "public"."discord_ticket_messages",
    "public"."discord_ticket_events";
