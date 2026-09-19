# discord-bot

A Discord bot for the StreamWizard server, built on Bun + discord.js v14.

## Internal structure

- `src/commands/` — one file per slash command. Each exports a default object satisfying `Command` (`data` + `execute`). Subfolders are supported — `commandHandler.ts` scans recursively, so group commands by category as the bot grows (e.g. `commands/moderation/ban.ts`).
- `src/events/` — one file per Discord gateway event. Each exports a default object satisfying `BotEvent` (`name` + `execute`, optional `once`). `eventHandler.ts` wires them all up automatically — no manual registration in `index.ts`.
- `src/handlers/` — the loaders that scan `commands/` and `events/` and attach everything to the client.
- `src/lib/discord-client.ts` — the `Client` singleton and its gateway intents. Start minimal; add intents only when a feature needs them (each one may require re-approval for verified bots).
- `src/lib/env.ts` — zod-validated environment variables.
- `src/lib/ticket-transcript.ts` — turns a Discord message into an archive row and reconciles a ticket channel against the archive (at close and at startup, inserting only what was missed). Images up to 500 KB (max 20 per ticket) are copied to R2 when the `R2_*` vars and `NEXT_PUBLIC_CDN_URL` are set; other files keep metadata only. `src/lib/tickets/archive.ts` is the live side: every message in an open ticket channel is written as it arrives (`archive_ticket_message` RPC, which also stamps the ticket's `last_message_at` / `first_response_at` for people's messages), edits and pins update the row, deletes flag it with `deleted_at`. `src/lib/ticket-activity.ts` holds the cached open-ticket map both the archive and the server log check first. On close the opener gets a DM with the conversation as a text file (`dm_on_close`, text under Messages in web-admin; `src/lib/tickets/close-dm.ts`), and `/ticket transcript` hands the same file to the opener or staff.
- `src/lib/tickets/` — the ticket system. `config.ts` is the cached read of everything web-admin configures (settings, categories, products; dropped by `POST /cache/tickets`), `open.ts` the category picker and form, `close.ts` the single close path. `form.ts` builds a category's modal from its configured questions and reads the answers back by field id; `panel.ts` posts the panel designed in web-admin (a `BuiltMessage`) with the Create Ticket controls from `panel-rows.ts` underneath; `intro.ts` is the opening message plus the ticket card. `access.ts` holds the pure rules (who may open a ticket, who is staff on it, the channel's full permission set); `actions.ts` the staff actions shared by `/ticket`, the intro buttons and the dashboard routes.
- `src/lib/tickets/sweeper.ts` — the stale sweeper. Every 5 minutes, per server: open tickets nobody has written in for `stale_after_hours` get the reminder from Messages (the "closing soon" one when `auto_close_after_hours` is set), and tickets whose reminder has stood unanswered for `auto_close_after_hours` are closed as `inactivity` with the "automatic close" text as reason, opener DM included. Both timers live on the Automation tab in web-admin and are off by default. The reminder is claimed with a conditional `UPDATE … WHERE stale_warned_at IS NULL` before anything is posted and the close goes through `finalizeTicketClose`, so a restart between ticks never repeats either; a person's message clears `stale_warned_at` inside `archive_ticket_message`. The decisions are pure (`sweep-rules.ts`) and tested against a fixed clock. Starts after the startup reconcile, stops on shutdown.
- `src/lib/tickets/close-request.ts` — who may end a ticket. `close_mode` (Automation tab) is `staff_only` (default), `request` or `either`. Under `request` the ticket card gets a Request close button and `/ticket close` from a non-staff participant becomes a request: the bot posts the Messages "close request" text with Accept and Keep-open buttons and pings the category's ping roles; staff answer in Discord or from the dashboard, and the sweeper lets an unanswered request lapse after `close_request_hours` (the ticket stays open). Under `either` the opener may close their own ticket outright. Every step is a conditional write on `close_requested_at`, so two clicks make one request. `working-hours.ts` is the pure clock side of working hours (`working_hours` jsonb, parsed by `@repo/supabase/queries/ticket-hours`): a ticket opened outside them gets the "outside working hours" line under its opening message with a live `<t:…:R>` countdown to the next opening. No presence data is used.
- `src/lib/tickets/feedback.ts` — the opener's rating. The closing DM ends with the Messages "rating prompt" and five star buttons (`ticket:feedback:<ticketId>:<n>`) for categories with `feedback_enabled`; a click stores the rating with a conditional UPDATE (the opener, once), swaps the buttons for a thank-you and opens an optional comment form. Both arrive outside any guild, so `handleTicketInteraction` routes them before its guild-only handlers. Each reaches the timeline as `feedback_submitted` and the log channel as `ticket.feedback`. `stats.ts` feeds the `[stats.avg_response]` / `[stats.avg_rating]` placeholders (rolling 30 days from `ticket_stats_summary`, cached 5 minutes) for the opening message and the closing DM. The web-admin stats page reads the same `ticket_stats_*` functions.
- `src/lib/tickets/tags.ts` and `src/commands/tag.ts` — canned answers, edited on the Tags tab. `/tag <name> [for]` posts one (staff only, autocomplete from the config cache); a tag with auto-reply and keywords posts itself once per ticket when a member's message contains a keyword (plain lowercase substring match, no regex from user input; the once-per-ticket guard is a `tag_replied` timeline entry cached on the open-ticket map). The dashboard reply box can paste a tag; `POST /tickets/:channelId/message` fills `[server.*]` / `[member.*]` with the opener.
- Context menus (`src/commands/create-ticket-from-message.ts`, `create-ticket-for-user.ts`, `pin-message.ts`) — right-click entries, registered by `deploy-commands` like slash commands and gated by the same role allowlist (their names contain spaces). "Create ticket from message" quotes the message into the form and stores its link on the ticket; "Create ticket for user" (staff) opens a ticket that belongs to the target, with the staff member as `created_by_discord_user_id`; "Pin in ticket" pins or unpins for staff. What a ticket started from lives in `src/lib/tickets/pending.ts` for the minutes between the menu and the form's submit, because a modal's customId can't carry a link.
- DM-to-open (`dm_open_enabled`, General tab, off by default) — a member who DMs the bot gets a Create ticket button for the one server that turned it on and has them as a member; the button, the category picker and the form then run the normal flow with the server resolved from the settings (`findDmTicketGuild` in `open.ts`). The DM's text is never read or stored, and one offer per person per ten minutes keeps a chatty DM from being answered line by line. Needs the `DirectMessages` intent, which is not privileged.
- `src/lib/permissions.ts` — per-command role allowlists, checked in `events/interactionCreate.ts` before any command runs.
- `src/http/` — internal Hono API that web-admin's Discord dashboard calls after a save (see below). `server.ts` starts it, `app.ts` wires middleware and routers, `middleware/` holds the bearer-secret and guild checks, `routes/` has one router per feature.
- `src/scripts/deploy-commands.ts` — registers slash commands with Discord. Run after adding/changing/removing a command.

## Adding a command

Create `src/commands/<name>.ts`:

```ts
import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types/discord";

export default {
  data: new SlashCommandBuilder().setName("hello").setDescription("Says hello"),
  async execute(interaction) {
    await interaction.reply("Hello!");
  },
} satisfies Command;
```

Then re-run `deploy-commands` (see below). No other wiring required.

If an option needs suggestions as the user types, call `.setAutocomplete(true)` on it and add an `autocomplete` handler to the command export — `events/interactionCreate.ts` dispatches `isAutocomplete()` interactions to it automatically:

```ts
async autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  await interaction.respond(
    SOME_LIST.filter((v) => v.includes(focused))
      .slice(0, 25)
      .map((v) => ({ name: v, value: v }))
  );
},
```

### Restricting a command to specific roles

Permissions are per-command, per-guild role allowlists — not a global tier system. A command with no configured roles is open to everyone; once at least one role is added, only members holding one of those roles can run it. No code change needed on the command itself — it's all managed at runtime:

```
/permissions set command:status role:@staff   # restrict /status to @staff
/permissions set command:status role:@mods    # @mods can also use it now (OR, not AND)
/permissions remove command:status role:@mods # revoke just that role
/permissions view command:status              # see who's allowed
/permissions view                              # see every restricted command
```

`/permissions` itself can only be run by the **server owner**. Discord has no "owner" permission flag, so this is checked in code (`interaction.user.id === interaction.guild.ownerId`) rather than via `setDefaultMemberPermissions` — the `ManageGuild` default on the command just hides it from members without Manage Server in their client, it isn't the actual gate. No bootstrap problem either way: the owner always exists and always has access — `canRunCommand` skips role allowlists for the owner on every command, so even restricting `/permissions` itself can't lock them out.

The web-admin Discord dashboard (`/discord/permissions`) edits the same table and refreshes the cache through the internal API.

Mappings live in the `discord_command_permissions` table in Supabase (`guild_id`, `command_name`, `role_id`) and are cached in-memory per `guild+command` for 5 minutes (`src/lib/permissions.ts`); `/permissions set`/`remove` invalidate the cache immediately so changes apply right away. Commands run outside a guild (DMs) are always unrestricted, since there's no guild role context to check.

The `command` option autocompletes against the currently loaded command names (`Command.autocomplete` in `permissions.ts`, dispatched from `events/interactionCreate.ts`'s `isAutocomplete()` branch) — there's no fixed list to maintain, it always reflects whatever's in `src/commands/`.

## Adding an event listener

Create `src/events/<name>.ts`:

```ts
import { Events } from "discord.js";
import type { BotEvent } from "../types/discord";

export default {
  name: Events.GuildMemberAdd,
  execute(member) {
    console.log(`${member.user.tag} joined`);
  },
} satisfies BotEvent<typeof Events.GuildMemberAdd>;
```

Picked up automatically on next start — no registration needed in `index.ts`.

## Internal API (web-admin dashboard)

web-admin's `/discord` pages write settings straight to Supabase, then call the bot so changes land without a restart. The bot starts a small Hono server (`src/http/`) when `DISCORD_BOT_INTERNAL_SECRET` is set; without it the server stays off and saves still apply once the in-memory caches expire (permissions 5 min, activity 60 s).

| Env var | Where | Notes |
|---|---|---|
| `DISCORD_BOT_INTERNAL_SECRET` | bot + web-admin | 16+ chars, same value on both sides. |
| `DISCORD_BOT_INTERNAL_PORT` | bot | Defaults to `3010`. |
| `DISCORD_BOT_INTERNAL_URL` | web-admin | e.g. `http://discord-bot:3010` on the internal Docker network. |

Don't publish the port on a public domain. Every route except `GET /health` needs `Authorization: Bearer <secret>`, and all live under `/internal/guilds/:guildId` (the bot must be in that guild):

| Route | Does |
|---|---|
| `POST /cache/permissions` `{ commandName? }` | Drops cached role allowlists (one command, or all). |
| `POST /cache/activity` `{ trackingDisabled }` | Drops cached activity settings; closes open voice sessions when tracking was turned off. |
| `POST /cache/log-settings` | Drops cached log channel settings. |
| `POST /cache/tickets` | Drops the cached ticket settings, categories and products. |
| `POST /verified-role` `{ oldRoleId, newRoleId }` | Moves members from the old verified role to the new one, in the background. |
| `POST /ticket-panel` `{ channelId? }` | Posts the ticket panel and removes the previous one. `channelId` moves it, `null` removes it, omitted re-posts it in place. |
| `POST /tickets/:channelId/claim` `{ discordUserId }` | Claims the ticket as that admin's Discord account. |
| `POST /tickets/:channelId/close` `{ discordUserId, reason? }` | Closes the ticket as that admin's Discord account, with an optional reason. |
| `POST /tickets/:channelId/release` `{ discordUserId }` | Gives a claimed ticket back. |
| `POST /tickets/:channelId/priority` `{ discordUserId, priority }` | Sets `low`, `medium`, `high` or `null`. |
| `POST /tickets/:channelId/subject` `{ discordUserId, subject }` | Rewords the subject. |
| `POST /tickets/:channelId/move` `{ discordUserId, category }` | Files the ticket under another category (slug): moves the channel when that category has its own Discord category and rewrites its permissions. |
| `POST /tickets/:channelId/members/add` / `members/remove` `{ discordUserId, targetDiscordUserId }` | Lets someone into the ticket, or takes them out. |
| `POST /tickets/:channelId/close-accept` / `close-reject` `{ discordUserId }` | Answers the opener's close request: accepting closes the ticket like a staff close, rejecting keeps it open. |
| `POST /tickets/:channelId/transfer` `{ discordUserId, targetDiscordUserId }` | Makes another member the ticket's owner; the previous owner stays as an added member. |
| `POST /tickets/:channelId/message` `{ authorName, authorAvatarUrl, content }` | Posts a staff reply in the ticket, credited to the sender. |
| `POST /welcome-cleanup` `{ previousChannelId }` | Deletes the bot's welcome posts from the previous welcome channel, in the background. |
| `POST /test-welcome` `{ discordUserId }` | Posts a mock welcome for that member without touching `join_number`. |
| `POST /built-messages/:id/publish` `{ channelId }` | Sends the saved message-builder draft to that channel, or updates what an earlier publish left there. |
| `POST /built-messages/:id/delete` | Removes the published message from Discord and deletes the row. |
| `POST /channels` `{ name }` | Creates a read-only text channel. 409 with `code: "name_taken"` when the name exists. |

To add a route: create or extend a router in `src/http/routes/`, read the guild with `c.get("guild")`, and mount new routers in `src/http/app.ts`.

## Log channels (platform and server events)

`src/lib/log-channel/` posts events to the log channels picked in web-admin under `/discord/logs/settings`. Each event type can go to its own channel; types without one use the default channel.

Four groups of events share one pipeline:
- **Platform events**: new user, Discord linked or unlinked, account deleted (with the reason: requested, or revoked on Twitch), plan granted, changed or revoked, admin role granted or revoked, feedback submitted, dashboard setting changed. Emitted by SQL triggers (`emit_platform_event`) and web-admin (`emitPlatformEvent`). Always stored, even when turned off.
- **Twitch events**: clip sync started, completed (count and duration) or failed (with the error), Twitch token refresh failed (one per user per 6 hours, `emit_twitch_token_refresh_failed`), stream online failed (the rest-api EventSub handler couldn't find the stream or its VOD). Clip sync events come from a trigger on `twitch_clip_syncs.sync_status`; the sync stores its error in `twitch_clip_syncs.last_error`. Always stored.
- **EventSub events**: the streamwizard-bot's own Twitch EventSub connection. Connected (first session after a start), connection lost (with the close code or keepalive silence), reconnected (downtime and attempts), session moved by Twitch (off by default, routine), subscription revoked, conduit update failed. Emitted by `apps/streamwizard-bot/src/lib/eventsub-log.ts` from the receiver's lifecycle events, the moment they happen. Always stored. These are the trail; the alert for an outage over a couple of minutes comes from the fleet alert engine (`eventsub.disconnected`), not from here.
- **Ticket events**: opened, claimed, closed, and staff replies sent from the dashboard. Emitted by the bot from the same place the ticket timeline is written (`recordTicketEvent` in `src/lib/tickets/events.ts`), with `source` set to `discord` or `dashboard`. Always stored. Every close goes through `finalizeTicketClose` (`src/lib/tickets/close.ts`) and carries a `close_code`; a close nobody clicked for, like a ticket channel deleted by hand, has no actor and the embed says why instead. These replaced the old per-close embed and its `log_channel_id` ticket setting; the migration moved that channel into the per-type routing. Set `WEB_ADMIN_URL` so the embeds link the ticket's dashboard page.
- **Server events** (`src/events/server-log/`): members joining, leaving, kicked, banned, unbanned, timed out, nickname and role changes; messages edited, deleted, bulk deleted; roles, channels and server settings changed; invites and voice (off by default). Emitted by the bot through `emitServerEvent` (`src/lib/server-log/emit.ts`), which skips types that are turned off. Moderators and reasons come from the audit log (`src/lib/server-log/audit.ts`).

How delivery works:
- `platform_events` in Supabase is the queue. The bot claims pending rows, posts one embed each and marks them delivered. Events queue up while the bot is offline and go out when it's back.
- A Realtime insert subscription wakes the worker right away, and a 30 s poll catches anything Realtime missed. Failed posts retry with backoff (5 s doubling, capped at 30 min, 12 attempts).
- Messages are sent with `nonce` = event id and `enforceNonce`, so a crash between posting and marking doesn't post twice, and with no allowed mentions, so logged text never pings.
- The bot runs as a single instance and releases leftover leases on startup.
- Routing lives in `discord_guild_settings.log_channel_id` (default channel), `log_ignored_channel_ids` (no message logs there) and `discord_log_event_settings` (per-type on/off and channel). No channel means the event is marked `skipped`.
- Message edits and deletes aren't logged in log channels, ignored channels, open tickets, or for bots and webhooks. Old text is only known for messages the bot saw since its last restart.
- Message text in `platform_events` is removed after 30 days (`purge_platform_event_message_text`, pg_cron) and when the author deletes their account. Feedback descriptions and ticket subjects on a user's events go when they delete their account.

Setup in Discord:
- Developer portal: turn on the **Server Members** and **Message Content** privileged intents. Direct Messages (for DM-to-open) needs no portal toggle.
- Server: give the bot's role **View Audit Log** (without it, moderators show as unknown and kicks show as leaves) and access to the channels you want logged.

Adding an event type: add it to `PLATFORM_EVENTS` in `packages/types/src/platform-events.ts` (label, group, default), emit it once, and add its style in `embed-kit.ts` and its formatter in `formatters.ts` or `server-formatters.ts` (the bot doesn't type-check until you do). Run `bun test` for the formatter and diff tests.

## Running locally

From the repo root:

```bash
bun dev --filter=@repo/discord-bot
```

## Deploying slash commands

Run whenever a command or context menu entry is added, changed, or removed (both live under `src/commands/`):

```bash
cd apps/discord-bot
bun run deploy-commands
```

Set `DISCORD_GUILD_ID` in dev for instant propagation to a single test server. Omit it in staging/production to register commands globally (can take up to an hour to propagate).
