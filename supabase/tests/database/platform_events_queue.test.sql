-- The platform event log doubles as the Discord bot's delivery queue. Only the
-- service role emits, claims and completes events (20260914210000).
-- Run: supabase test db --local
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(18);

-- Grants -----------------------------------------------------------------------
SELECT ok(NOT has_function_privilege('anon', 'public.emit_platform_event(text, uuid, uuid, jsonb)', 'EXECUTE'), 'anon cannot emit events');
SELECT ok(NOT has_function_privilege('authenticated', 'public.emit_platform_event(text, uuid, uuid, jsonb)', 'EXECUTE'), 'authenticated cannot emit events');
SELECT ok(NOT has_function_privilege('authenticated', 'public.claim_platform_events(integer, integer)', 'EXECUTE'), 'authenticated cannot claim events');
SELECT ok(NOT has_function_privilege('authenticated', 'public.complete_platform_event(bigint, text, text, text, integer)', 'EXECUTE'), 'authenticated cannot complete events');
SELECT ok(NOT has_function_privilege('authenticated', 'public.release_platform_event_locks()', 'EXECUTE'), 'authenticated cannot release leases');
SELECT ok(has_function_privilege('service_role', 'public.claim_platform_events(integer, integer)', 'EXECUTE'), 'the service role claims events');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"50900000-0000-4000-8000-0000000009b1","role":"authenticated","aal":"aal2"}';
SELECT throws_ok($$INSERT INTO public.platform_events (event_type) VALUES ('user.deleted')$$,
  '42501', NULL, 'a signed-in user cannot write to the event log');
SELECT throws_ok($$SELECT public.claim_platform_events(10, 60)$$,
  '42501', NULL, 'a signed-in user cannot claim queue entries');
RESET ROLE;

-- Queue behaviour (as the service role, like the bot) -----------------------------
SET LOCAL ROLE service_role;
SELECT isnt(public.emit_platform_event('swtest.due_one', NULL, NULL, '{"n":1}'), NULL, 'emit returns the new id');
SELECT public.emit_platform_event('swtest.due_two', NULL, NULL, '{}');
SELECT public.emit_platform_event('swtest.later', NULL, NULL, '{}');
UPDATE public.platform_events SET next_attempt_at = now() + interval '1 hour' WHERE event_type = 'swtest.later';
SELECT is(public.emit_platform_event('Not A Valid Type', NULL, NULL, '{}'), NULL,
  'a malformed event type is dropped, not raised into the caller');

CREATE TEMP TABLE claimed ON COMMIT DROP AS
  SELECT id, event_type, attempts, locked_until FROM public.claim_platform_events(1000000, 60);

SELECT results_eq($$SELECT event_type FROM claimed WHERE event_type LIKE 'swtest.%' ORDER BY id$$,
  ARRAY['swtest.due_one', 'swtest.due_two'], 'claim returns due events and skips ones scheduled later');
SELECT results_eq($$SELECT DISTINCT attempts FROM claimed WHERE event_type LIKE 'swtest.%'$$,
  ARRAY[1], 'a claim counts an attempt');
SELECT ok((SELECT bool_and(locked_until > now()) FROM claimed WHERE event_type LIKE 'swtest.%'), 'a claim takes a lease');
SELECT is_empty($$SELECT 1 FROM public.claim_platform_events(1000000, 60) WHERE event_type LIKE 'swtest.%'$$,
  'leased events are not handed out twice');

SELECT public.complete_platform_event((SELECT id FROM claimed WHERE event_type = 'swtest.due_one'), 'delivered', '123', NULL);
SELECT results_eq($$SELECT status, locked_until IS NULL FROM public.platform_events WHERE event_type = 'swtest.due_one'$$,
  $$VALUES ('delivered', true)$$, 'delivered clears the lease');

SELECT public.complete_platform_event((SELECT id FROM claimed WHERE event_type = 'swtest.due_two'), 'failed', NULL, 'boom', 12);
SELECT results_eq($$SELECT status, next_attempt_at > now() FROM public.platform_events WHERE event_type = 'swtest.due_two'$$,
  $$VALUES ('pending', true)$$, 'a failure under the attempt limit is retried later');

SELECT public.complete_platform_event((SELECT id FROM claimed WHERE event_type = 'swtest.due_two'), 'failed', NULL, 'boom', 1);
SELECT results_eq($$SELECT status FROM public.platform_events WHERE event_type = 'swtest.due_two'$$,
  ARRAY['failed'], 'a failure at the attempt limit gives up');

SELECT throws_ok($$SELECT public.complete_platform_event((SELECT id FROM claimed WHERE event_type = 'swtest.due_one'), 'lost')$$,
  'P0001', NULL, 'an unknown status is refused');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
