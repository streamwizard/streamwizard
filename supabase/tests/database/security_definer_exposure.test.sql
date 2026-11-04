-- SECURITY DEFINER functions skip RLS, so each one a client role can call is
-- an API of its own. This pins the list: a new definer function must revoke
-- EXECUTE from PUBLIC/anon/authenticated (the schema's default privileges
-- grant it) or be added here on purpose, with its own test.
-- Trigger functions are left out: they cannot be called directly.
-- Run: supabase test db --local
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(2);

CREATE TEMP VIEW definer_functions AS
  SELECT p.oid, p.oid::regprocedure::text AS signature
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND p.prorettype <> 'trigger'::regtype;

SELECT is_empty(
  $$SELECT signature FROM definer_functions
    WHERE has_function_privilege('authenticated', oid, 'EXECUTE')
      AND signature NOT IN (
        'check_user_role(text)',
        'is_strong_admin()',
        'check_product_access(text)',
        'get_product_access(text)',
        'link_discord_integration(text,text,text,text)',
        'increment_widget_installs(uuid)'
      )$$,
  'signed-in users can execute only the known security definer functions');

SELECT is_empty(
  $$SELECT signature FROM definer_functions
    WHERE has_function_privilege('anon', oid, 'EXECUTE')
      AND signature NOT IN (
        'check_product_access(text)',
        'get_product_access(text)',
        'increment_widget_installs(uuid)'
      )$$,
  'anon can execute only the known security definer functions');

SELECT * FROM finish();
ROLLBACK;
