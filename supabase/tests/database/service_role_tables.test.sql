-- Service-role-only tables: no privileges for anon or authenticated.
-- Run: supabase test db --local
-- Everything happens inside one transaction that is rolled back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(9);

-- Any public table with RLS on and no permissive policy is service-role only,
-- so anon and authenticated hold no privilege on it.
SELECT is_empty(
  $$SELECT c.relname::text
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind = 'r'
      AND c.relrowsecurity
      AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND p.polpermissive)
      AND (has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
        OR has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'))$$,
  'service-role-only tables grant nothing to anon or authenticated');

SELECT is_empty(
  $$SELECT relname::text FROM pg_class
    WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND NOT relrowsecurity$$,
  'every public table has RLS on');

-- Visitors -------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT throws_ok('SELECT id FROM public.obs_nodes', '42501', NULL, 'anon cannot read obs nodes');
SELECT throws_ok('SELECT id FROM public.ingest_nodes', '42501', NULL, 'anon cannot read ingest nodes');
RESET ROLE;

-- Signed-in users ------------------------------------------------------------
SELECT set_config('request.jwt.claims',
  '{"sub":"f5000000-0000-4000-8000-000000000021","role":"authenticated","aal":"aal2"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok('SELECT 1 FROM public.twitch_app_token', '42501', NULL, 'authenticated cannot read the app token');
SELECT throws_ok($$DELETE FROM public.discord_guild_settings$$, '42501', NULL, 'authenticated cannot write guild settings');
SELECT throws_ok('TRUNCATE public.alert_locks', '42501', NULL, 'authenticated cannot truncate alert locks');
RESET ROLE;

-- The service role keeps full access ------------------------------------------
SET LOCAL ROLE service_role;
SELECT lives_ok('SELECT id FROM public.obs_nodes', 'service_role reads obs nodes');
SELECT lives_ok('SELECT 1 FROM public.twitch_asset_cache', 'service_role reads the asset cache');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
