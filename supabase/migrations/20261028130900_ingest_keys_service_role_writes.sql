-- Ingest and output keys cost ingest capacity, so creating them needs a plan.
-- The dashboard actions now check that and write with the service role, but
-- authenticated still held INSERT/UPDATE/DELETE on both tables with an
-- owner-only FOR ALL policy, so a signed-in user without a plan could mint
-- keys straight through PostgREST. No app code writes these tables with a user
-- session; users keep SELECT on their own rows.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.ingest_stream_keys FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.ingest_output_keys FROM anon, authenticated;
