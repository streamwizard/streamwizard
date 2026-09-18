# Platform events, Tier 1

Follow-up to SW-334. The log channel today covers account and plan lifecycle plus Discord server
events, and nothing about the product itself. This adds the first batch of product and staff
events. Everything rides the existing `platform_events` queue, worker, routing and dashboard;
no new infrastructure.

Branch: `discord-bot` (the whole Discord epic stays on that branch). Migrations get unique
timestamps (`20260915120000` onwards) because the local database is shared across worktrees.

## New event types

| Type | Group | Default | Emitted from | Why |
|---|---|---|---|---|
| `clips.sync_started` | twitch | on | SQL trigger on `twitch_clip_syncs` | See a sync begin, and spot stuck syncs. |
| `clips.sync_completed` | twitch | on | SQL trigger | Clip count and duration per run. |
| `clips.sync_failed` | twitch | on | SQL trigger | Today only Sentry sees this. |
| `twitch.token_refresh_failed` | twitch | on | `packages/twitch-api` | User's Twitch integration is dead; support finds out from a ticket. |
| `stream.online_failed` | twitch | on | `apps/rest-api` stream.online handler | The two silent bail-outs abandon VOD, live status and viewer polling. |
| `ticket.opened` | tickets | on | bot `recordTicketEvent` funnel | Staff see new tickets without watching the category. |
| `ticket.claimed` | tickets | on | bot funnel | Includes claims from the web-admin dashboard. |
| `ticket.closed` | tickets | on | bot funnel | Duration and transcript size. |
| `ticket.replied` | tickets | on | bot internal API `/tickets/:channel/message` | Audit for staff replies sent from the dashboard. |
| `admin.role_granted` | platform | on | SQL trigger on `user_roles` | Security trail. Roles are granted by hand today. |
| `admin.role_revoked` | platform | on | SQL trigger | Same. |
| `feedback.submitted` | platform | on | SQL trigger on `feedback` | Feedback form writes straight to the table. |

Plus one payload change: `user.deleted` gains `reason: "requested" | "twitch_revoked"` so a
self-service deletion and a Twitch-side revoke are told apart.

Two new groups in `PLATFORM_EVENT_GROUPS`:

- `twitch`: label "Twitch", hint "Clip syncs, token problems and stream events that went wrong."
- `tickets`: label "Tickets", hint "Tickets opened, claimed, closed and replied to from the dashboard."

The settings form and the log viewer render groups from that array, so the dashboard picks them
up without changes.

## Step 1: types, styles, formatters, tests

Files: `packages/types/src/platform-events.ts`, `apps/discord-bot/src/lib/log-channel/embed-kit.ts`
(`STYLE`), `formatters.ts`, `formatters.test.ts`.

The formatter map and `STYLE` are typed on the union, so the bot won't compile until every new
type has both. Do this step first and the rest can land in any order.

Payloads:

```ts
// twitch
"clips.sync_started":   SubjectIdentity & { sync_id: string; last_sync?: string | null };
"clips.sync_completed": SubjectIdentity & { sync_id: string; clip_count: number; duration_seconds: number | null };
"clips.sync_failed":    SubjectIdentity & { sync_id: string; duration_seconds: number | null; error?: string | null };
"twitch.token_refresh_failed": SubjectIdentity & { error: string; status?: number | null };
"stream.online_failed": SubjectIdentity & { reason: "stream_not_found" | "vod_not_found"; stream_id?: string | null };

// tickets (ServerEvent so routing works per guild, and the Twitch link is filled in)
interface TicketEvent extends ServerEvent {
  ticket_id: string;
  ticket_number: number;
  subject: string;            // truncated to 100 chars
  category: string;
  product?: string | null;
  opener: DiscordUserRef;
  channel: DiscordChannelRef; // gone after close; the embed links the dashboard page instead
  source: "discord" | "dashboard";
}
"ticket.opened":  TicketEvent;
"ticket.claimed": TicketEvent & { actor: DiscordUserRef };
"ticket.closed":  TicketEvent & { actor: DiscordUserRef; duration_seconds: number; message_count?: number | null };
"ticket.replied": TicketEvent & { author_name: string };   // no message content

// platform
"admin.role_granted": SubjectIdentity & { role: string };
"admin.role_revoked": SubjectIdentity & { role: string };
"feedback.submitted": SubjectIdentity & {
  feedback_id: string; title: string; category: string; priority: string;
  description: string;        // first 300 chars
  contact?: string | null;    // the free-text "discord" field, shown as plain text, never a mention
};
"user.deleted": SubjectIdentity & { reason?: "requested" | "twitch_revoked" };
```

Embed notes:

- `clips.sync_failed`, `twitch.token_refresh_failed`, `stream.online_failed`: `DANGER_RED`.
- `stream.online_failed` with `vod_not_found`: add a line "VODs may be turned off on Twitch" so
  staff don't chase a bug that is a user setting.
- `ticket.*`: link the dashboard page `/discord/tickets/<number>` (web-admin base URL from a new
  optional bot env `WEB_ADMIN_URL`; omit the link when unset). Author line is the opener.
- `admin.role_*`: actor is null today (granted by SQL). Field "By" shows "Database" until an
  admin UI exists.
- Retention: `delete_user_data` already strips message text. Extend it to strip `description`,
  `subject` and `contact` from events where `subject_user_id` is the deleted user.

Tests: the existing "every type renders with an empty payload" test covers the new ones. Add one
specific test per type checking title, colour and the key field.

## Step 2: migration `20260915120000_platform_events_tier1.sql`

**Clip syncs.** Add `twitch_clip_syncs.last_error text`. Trigger `log_clip_sync_change` AFTER
INSERT OR UPDATE OF `sync_status`:

- INSERT, or UPDATE to `syncing`: `clips.sync_started`.
- UPDATE to `completed`: `clips.sync_completed` with `clip_count` and
  `extract(epoch from now() - last_sync)` (the sync writes `last_sync = now()` on start).
- UPDATE to `failed`: `clips.sync_failed` with `last_error`.
- No event when the status doesn't change. Identity from `integrations_twitch` by `user_id`.

**Admin roles.** Trigger `log_user_role_change` AFTER INSERT OR DELETE on `user_roles`:
`admin.role_granted` / `admin.role_revoked`, subject `user_id`, payload `role` plus identity.

**Feedback.** Trigger `log_feedback_submitted` AFTER INSERT on `feedback`, subject `user_id`
(nullable), payload as above with `left(description, 300)`.

**Token refresh dedupe.** `emit_twitch_token_refresh_failed(p_twitch_user_id text, p_error text, p_status int)`:
looks up the user, skips when a `twitch.token_refresh_failed` for the same subject exists in the
last 6 hours (a dead token fails on every API call), else emits. `SECURITY DEFINER`, service role
only.

**Deletion reason.** `delete_user_data` gets `p_reason text DEFAULT 'requested'`. A new parameter
list is a new overload in Postgres, so `DROP FUNCTION public.delete_user_data(text)` first,
recreate, re-apply the grants (service role only). Also add the payload strip described above.

All triggers use the same `EXCEPTION WHEN OTHERS THEN RAISE LOG` pattern as
`log_discord_integration_change`, so a log failure never fails the write.

Hand-edit `packages/supabase/src/types/supabase.ts`: `twitch_clip_syncs.last_error`, the new rpc
args for `delete_user_data` and `emit_twitch_token_refresh_failed`. Don't regenerate from remote.

## Step 3: rest-api

- `apps/rest-api/src/functions/twitch-eventsub-events/stream-online.ts`: in both bail-outs, after
  `reportError`, emit `stream.online_failed` through `emitPlatformEvent` (subject from
  `getTwitchIntegrationByBroadcasterId`). Never throw from the emit.
- `apps/rest-api/src/functions/sync-twitch.ts`: pass the error message to
  `updateClipSyncStatus(..., "failed", undefined, message)`; the trigger does the rest.
- `packages/supabase/src/queries/sync.ts`: `updateClipSyncStatus` accepts an optional `error`
  and writes `last_error` (cleared to null on `completed`).
- `user-authorization-revoke.ts`: call `delete_user_data` with `p_reason: "twitch_revoked"`.

## Step 4: twitch-api

`packages/twitch-api/src/base-client.ts`, `refreshUserToken` catch block: when the failure is
permanent (Axios 400/401 from `id.twitch.tv`, or "No refresh token found"), call
`supabase.rpc("emit_twitch_token_refresh_failed", ...)` fire-and-forget with its own catch.
Network errors and 5xx don't emit. The package already imports the Supabase client for the
token queries.

## Step 5: discord-bot tickets

**Replaces the old ticket log.** `discord_ticket_settings.log_channel_id` posts one embed when a
ticket closes, straight from `closeTicketChannel` with `logChannel.send`: no queue, no retry, no
dedupe, no open or claim events, and not visible in the `/discord/logs` viewer. Running both
would post two embeds per close and leave two "log channel" pickers that mean different things.
So the old path goes:

- Migration (same file as step 2): for each guild with `log_channel_id` set, insert
  `discord_log_event_settings` rows for `ticket.opened`, `ticket.claimed`, `ticket.closed` and
  `ticket.replied` with that channel, so the channel staff already picked keeps working. Then
  `ALTER TABLE discord_ticket_settings DROP COLUMN log_channel_id`.
- `apps/discord-bot/src/lib/tickets.ts`: remove the embed block at the end of `closeTicketChannel`
  (the `settings?.log_channel_id` branch). `getTicketOpenerProfile` and `accountFieldValue` stay;
  the claim and GitHub embeds still use them.
- `apps/discord-bot/src/commands/ticket.ts`: drop the `log-channel` option from `/ticket setup`
  and the "Log channel" line from `/ticket status`.
- `apps/discord-bot/src/lib/setup-wizard.ts`: drop `stepTicketLogChannel`, the two `SETUP_IDS`
  entries and cases, and the summary line. The panel channel step goes straight to the summary,
  which gets one line: "Logs: set up in the web-admin dashboard under Discord, Logs."
- `apps/web-admin`: drop the log channel picker from `components/discord/tickets-form.tsx`, the
  `logChannelId` field from the schema, `before`/`after` and `assertChannel` in
  `actions/discord-tickets.ts`, and the initial value in `tickets/settings/page.tsx`.
- Hand-remove `log_channel_id` from `discord_ticket_settings` in
  `packages/supabase/src/types/supabase.ts`.

The new `ticket.closed` embed carries what the old one did (subject, product, category, opener,
claimer, closer, StreamWizard account) plus duration and transcript size.

Then the new path:

- `apps/discord-bot/src/lib/server-log/emit.ts`: `emitServerEvent` gets an option
  `{ store: "always" }` so ticket events are stored even when the type is turned off (they're low
  volume and the log viewer should have them). Default behaviour unchanged.
- `apps/discord-bot/src/lib/tickets.ts`: `recordTicketEvent` takes the ticket row, the guild and a
  `source`. After `insertTicketEvent` it calls `emitServerEvent(guild, "ticket.<type>", payload,
  { subjectDiscordId: opener, actorDiscordId: actor, store: "always" })`.
  `claimTicketAs` and `closeTicketChannel` get a `source` parameter; the button handlers pass
  `"discord"`, the internal API passes `"dashboard"`.
- `apps/discord-bot/src/http/server.ts`, `/tickets/:channelId/message`: emit `ticket.replied`
  after the message is posted. Look the ticket up by channel (the open-ticket cache in
  `ticket-activity.ts` already has it).
- Skip `ticket.*` events in `shouldLogMessage`? Not needed: ticket channels are already excluded
  from message logs.

## Step 6: docs

- `apps/discord-bot/README.md`, "Log channels" section: list the new groups and the two setup
  notes (`WEB_ADMIN_URL`, clip sync `last_error`).
- Doppler: `WEB_ADMIN_URL` on the bot (stg + prd), optional.

## Verification

1. `bun test` in `apps/discord-bot` (formatters) and `bunx tsc --noEmit` in discord-bot,
   rest-api, web-admin.
2. Apply the migration locally (`supabase migration up --local`, or `docker exec … psql` if the
   CLI refuses), then:
   - `UPDATE twitch_clip_syncs SET sync_status = 'failed', last_error = 'test'` on a test row and
     check three `platform_events` rows appear across a start/complete/fail cycle.
   - `INSERT INTO user_roles` / `DELETE` for the test user.
   - `INSERT INTO feedback`.
   - `SELECT emit_twitch_token_refresh_failed('999', 'invalid_grant', 400)` twice; one row.
3. Bot running locally against local Supabase: open, claim (button), claim (dashboard), reply
   (dashboard), close. Five embeds in the log channel, sources correct.
4. Trigger a clip sync from the app and watch started then completed land.

## Suggested tickets

One story under the Discord bot epic (SW-331), "Product events in the log channel (Tier 1)",
with sub-tasks matching steps 1 to 6. Step 1 first; steps 2 to 5 are independent after that.

## Out of scope, noted for Tier 2

- `twitch.reconnected` when a user with a failed token logs in again.
- Marking syncs stuck in `syncing` for over an hour as failed (a pg_cron sweep), which would
  then emit `clips.sync_failed` for free through the trigger.
- OBS instance lifecycle (trigger on `obs_instances.status`), `stream.started` / `stream.ended`,
  widget library approvals, AutoMod and webhook events on the Discord side.
