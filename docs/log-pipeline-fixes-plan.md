# Log pipeline: bug fixes and migration collapse

Follow-up to the review of the uncommitted `discord-bot` branch (2026-09-15). Two parts:
part 1 fixes the five confirmed bugs and the two index problems; part 2 collapses the
uncommitted migrations so each function is defined once. Nothing in scope is committed or
deployed, so migration files can be edited in place.

## Part 1: bugs

### 1. Server events stored for guilds with no log channel

`apps/discord-bot/src/lib/server-log/emit.ts`, `isServerEventEnabled`: checks `enabled` but not
whether a channel exists. A guild with a `discord_guild_settings` row but no `log_channel_id`
stores every message edit (with text), join, role change; the worker then marks them
"skipped: No log channel set".

- Change `isServerEventEnabled` to
  `const route = resolveLogRoute(routing, type); return route.enabled && !!route.channelId;`.
- `getLogChannelIds` and `shouldLogMessage` are unaffected.
- Test: `packages/supabase/src/queries/platform-events.ts` has `resolveLogRoute`; add a unit test
  in the bot (`server-log/emit.test.ts` doesn't exist; add one for a pure `isRouted(routing, type)`
  helper extracted from `isServerEventEnabled`, no Discord client needed).

### 2. Bot logs its own actions

Two sources, both confirmed:
- Every ticket open emits `channel.created` by the bot. The channel is created before
  `createTicket` inserts the row (`lib/tickets.ts`), so `isOpenTicketChannel` can't filter it.
- Every join emits `member.roles_changed` by the bot from `grantJoinRole` (`lib/welcome.ts`) and
  the verified-role grant in `events/guildMemberAdd.ts`.

Only `events/server-log/channelDeleted.ts` filters the bot today
(`audit?.moderator?.id === channel.client.user.id`). The audit log is best-effort (needs View
Audit Log, 1.5 s delay, 10 s window), so an audit-only filter leaks when the permission is
missing. Do both:

- New `apps/discord-bot/src/lib/server-log/self-actions.ts`: a tiny in-memory set of
  `"<kind>:<id>"` keys with a 30 s TTL. `markSelfAction("channel", channelId)` /
  `markSelfAction("roles", memberId)` and `isSelfAction(kind, id)`. No cache class needed
  (a Map with a timeout per key).
- Call `markSelfAction("channel", channel.id)` in `handleModalSubmit` right after
  `guild.channels.create`, and `markSelfAction("roles", member.id)` in `grantJoinRole` and the
  verified-role grant, before `roles.add`.
- `events/server-log/channelCreated.ts`: return early when `isSelfAction("channel", id)`.
  `memberUpdated.ts` roles branch: return early when `isSelfAction("roles", newMember.id)`.
- `lib/server-log/audit.ts`, `findAuditEntry`: return `{ self: true }` (or a `bySelf` flag on
  `AuditMatch`) when the executor is `guild.client.user.id`; every caller that already has an
  audit result skips on it. This covers manual bot-driven actions (panel repost, welcome
  cleanup) without a mark. `channelDeleted.ts` switches to the flag.

### 3. Ticket close and claim races

`packages/supabase/src/queries/tickets.ts`:
- `closeTicket`: add `.eq("status", "open")`, `.select().maybeSingle()`, return
  `DiscordTicket | null` (same shape as `claimTicket`).
- `claimTicket`: add `.eq("status", "open")`.

`apps/discord-bot/src/lib/tickets.ts`:
- `CloseTicketResult` gains `"already_closed"`, `CLOSE_RESULT_MESSAGES` gets
  "This ticket was already closed." The transcript is captured first (unchanged), then
  `closeTicket`; when it returns null, return `"already_closed"` without deleting the channel
  (the winner deletes it). Use the returned row for `recordTicketEvent`, which also removes the
  second `getTicketByChannelId` read (the row includes `transcript_message_count` because
  `saveTicketTranscript` ran before).
- `apps/discord-bot/src/http/server.ts` close route: map `already_closed` to 409.
- `apps/web-admin/src/actions/discord-ticket-actions.ts`: no change; the bot's error string
  surfaces through `callBot`.

### 4. Permissions fail open for 5 minutes

`apps/discord-bot/src/lib/permissions.ts`, `getAllowedRoleIds`: the catch reports and then the
empty list is cached for the TTL. Return `[]` from inside the catch without `cache.set`, so the
next call retries the database. The comment already describes the problem; replace it with
"Fails open for this one call only; nothing is cached, so the next call retries."

### 5. Twitch revoke skips the R2 attachment purge

`apps/rest-api/src/functions/twitch-eventsub-events/user-authorization-revoke.ts` calls
`delete_user_data` + `auth.admin.deleteUser`. `apps/web-streamwizard/src/actions/auth/delete-account.ts`
also deletes the user's ticket screenshots from the CDN bucket. Revoked users keep their images
in R2.

- `packages/storage` has no `@repo/supabase` dependency; keep it that way. Put the shared step in
  `packages/supabase/src/queries/tickets.ts` as
  `deleteTicketAttachments(client, discordUserId, deleteObject: (key: string) => Promise<void>)`:
  fetch keys (existing `getTicketAttachmentKeysByAuthor`), delete each, return the count.
  Callers pass `r2.deleteObject`.
- rest-api: needs `R2_*` in its env schema (`apps/rest-api/src/lib/env.ts`, optional like the
  bot) and `@repo/storage` as a dependency. In the revoke handler, before the RPC: look up
  `integrations_discord.discord_user_id` by `user_id` (the RPC returns the user id only after
  deleting, so resolve `user_id` from `integrations_twitch` first), then
  `deleteTicketAttachments(...)` wrapped in try/catch + `reportError`. Skip when R2 isn't
  configured.
- web-streamwizard: replace its inline block with the same call.
- Doppler: `R2_*` vars for rest-api (stg + prd). Without them the purge is skipped and reported
  once at startup (log a warning in the handler when the vars are missing).

The verified-role removal in `delete-account.ts` stays where it is: the bot's `user.deleted`
handling can do that later for both paths (Tier 2).

### 6. Indexes and retention predicate

In `supabase/migrations/20260914210000_platform_events.sql` (uncommitted, edit in place):
- `CREATE INDEX platform_events_subject_idx ON platform_events (subject_user_id, event_type, created_at DESC) WHERE subject_user_id IS NOT NULL;`
  Covers the account-deletion strip and the token-refresh dedupe.

In `supabase/migrations/20260915090000_server_log_retention.sql`:
- Index predicate becomes `WHERE event_type LIKE 'message.%' AND NOT (payload ? 'text_purged')`.
- The UPDATE adds `AND NOT (payload ? 'text_purged')`. The `?|` check stays as a belt-and-braces.
- Same `NOT (payload ? 'text_purged')` on the two strips in `delete_user_data`.

### Optional, cheap, same area

- `events/server-log/messageEdited.ts`: require `message.editedTimestamp` and, when the old
  message is cached, `oldMessage.editedTimestamp !== message.editedTimestamp`. Stops embed
  unfurls and pins on uncached messages being logged as edits. One condition.

## Part 2: collapse the migrations

All of these are untracked (`git status`), none applied to staging or production. Final layout:

| File | Keeps |
|---|---|
| `20260914190000_discord_ticket_history.sql` | unchanged |
| `20260914191000_delete_user_data_discord_tickets.sql` | **deleted** (only `delete_user_data`) |
| `20260914200000_discord_ticket_product.sql` | unchanged |
| `20260914210000_platform_events.sql` | table, queue functions, log settings, `emit_platform_event`, **plus** `platform_event_identity(uuid)`, `strip_platform_event_text(jsonb, text[])`, the new subject index |
| `20260914211000_platform_event_emitters.sql` | `handle_new_user`, `log_discord_integration_change` using `platform_event_identity`; **`delete_user_data` removed**; header note about the anon grant hole moved to the tier1 file |
| `20260914212000_discord_settings_audit_log_channel.sql` | unchanged |
| `20260915090000_server_log_retention.sql` | uses `strip_platform_event_text`, fixed predicate |
| `20260915120000_platform_events_tier1.sql` | clip sync, roles, feedback triggers, token refresh function, the **single** `delete_user_data(text, text)` (with `DROP FUNCTION delete_user_data(text)` for the deployed overload), ticket log seed + column drop |

Details:
- `platform_event_identity` moves from tier1 to 210000 next to `emit_platform_event`, with
  `GRANT EXECUTE ... TO service_role` so TS can call it (part of the Tier 2 identity
  consolidation, not needed now, but the grant is free).
- `strip_platform_event_text(p_payload jsonb, p_keys text[]) RETURNS jsonb IMMUTABLE`:
  `(p_payload - p_keys) || '{"text_purged": true}'`. Used by the retention function and the two
  strips in `delete_user_data`. The deliberate omission of `lines` in the deletion strip gets a
  comment.
- `log_discord_integration_change` builds its payload as
  `platform_event_identity(v_row.user_id) || jsonb_build_object('discord_user_id', v_row.discord_user_id, ...)`.
  The override is needed on DELETE (the discord row is gone by then). `handle_new_user` stays
  hand-built: the integrations row is written by a later trigger. Say so in its comment.
- `delete_user_data` in tier1 uses `platform_event_identity(v_user_id) || jsonb_build_object('reason', ...)`
  and reads `v_discord_user_id` before the identity call is no longer needed for the payload
  (still needed for the ticket anonymisation).
- `log_user_role_change`: filter `IF v_row.role NOT IN ('admin', 'smp_admin') THEN RETURN` so the
  "Admin role granted" label stays true. (Cheap, from the review.)
- Ticket log seed: seed only `ticket.closed` with the old channel. The other three follow the
  default channel. Matches what the old log did, and the comment says so.
- `log_clip_sync_change`: compute `v_duration` only in the completed/failed branches and only
  when `TG_OP = 'UPDATE'`.
- `packages/types/src/platform-events.ts`: delete `MESSAGE_TEXT_PAYLOAD_KEYS` and
  `USER_TEXT_PAYLOAD_KEYS` (zero call sites; SQL is the source of truth).
- `packages/supabase/src/types/supabase.ts`: add `platform_event_identity` to `Functions`.

Local database: the old versions of these migrations are already applied locally. After
editing, the only clean way is `supabase db reset --local` (asks first; it wipes local data),
or drop and re-apply by hand with `docker exec ... psql`. Reset is simpler.

## Order and verification

1. Part 1 items 1 to 4 and the optional edit (bot only). `bunx tsc --noEmit` + `bun test` in
   the bot.
2. Part 1 item 5 (rest-api + web-streamwizard + packages/supabase). `bunx tsc --noEmit` in all
   three.
3. Part 2 + item 6 together (one pass over the migration files). `supabase db reset --local`,
   then rerun the rolled-back smoke test from the Tier 1 plan (clip cycle, roles, feedback,
   token dedupe) and `SELECT proname, pg_get_function_arguments(oid) FROM pg_proc WHERE proname IN ('delete_user_data', 'platform_event_identity', 'strip_platform_event_text')`.
4. Live check with the bot: open a ticket and confirm no `channel.created`; join with an alt and
   confirm no `member.roles_changed`; close the same ticket from two clients and confirm one
   `ticket.closed` and one "already closed".

Estimate: half a day for part 1, two hours for part 2.
