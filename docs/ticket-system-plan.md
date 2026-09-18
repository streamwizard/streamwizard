# Ticket system expansion: feature parity + full web-admin control

## Context

Comparison against `discord-tickets/bot` (v4.0.51) showed our ticket system is strong on the dashboard side (list, live view, reply/claim/close from web, R2 image copies, GitHub sync, GDPR anonymisation) but thin on lifecycle and configuration:

- Categories are defined three times (PG enum `discord_ticket_category`, bot `CATEGORY_CHOICES`, web-admin `TICKET_CATEGORY_LABELS`); products once in code (`TICKET_PRODUCTS`). Panel, modal and intro copy are literals in `apps/discord-bot/src/lib/tickets.ts`.
- No limits, cooldown, close reason, unclaim, add/remove member, priority, stale auto-close, DM on close, feedback, metrics, tags.
- Correctness gaps: a ticket channel deleted by hand leaves the row `open` forever; the GitHub close path sets `status = closed` with no `closed_at`, transcript or event (so those tickets are never purged); `supabase/functions/sweep-ticket-deletions/index.ts` selects a dropped column.

Decisions taken with the user:
- Parity with discord-tickets, minus i18n, encryption at rest, export/import.
- Everything controllable from web-admin, nothing hard-coded. Short system notices and errors stay in code.
- Two dimensions stay: categories (carry behaviour) and products (label list). Both DB-backed.
- Live message archiving replaces capture-at-close.
- **GitHub integration is removed entirely** (Move to GitHub button, webhook status sync, 24 h grace deletion, Edge Function sweep). Its two known flaws go away with it.

Outcome: the bot reads all ticket behaviour and copy from the database, web-admin edits all of it, and the dashboard can do every staff action Discord can.

## Design

### Data model
Tickets keep storing **slugs** for category and product. Labels resolve from tables, including archived rows.

| Table | Purpose |
|---|---|
| `discord_ticket_categories` | `guild_id`, immutable `slug` (max 32, unique per guild), name, description, emoji, position, enabled, `archived_at`, `discord_category_id` (null = settings default), `staff_role_ids text[]`, `ping_role_ids text[]`, `required_role_ids text[]`, `channel_name_template`, `opening_message jsonb` (builder document), `claiming_enabled`, `feedback_enabled`, `member_limit`, `total_limit` (max 50), `cooldown_seconds`, `slowmode_seconds` |
| `discord_ticket_products` | `guild_id`, slug, label, emoji, description, position, `archived_at`. Max 25 active (one select) |
| `discord_ticket_form_fields` | per category, `kind` subject/description/product/text/select, label, placeholder, style, required, min/max length, default, `options jsonb`, position. Max 5 per category (Discord modal limit) |
| `discord_ticket_answers` | `ticket_id`, `field_id` (set null on delete), label snapshot, value, position |
| `discord_ticket_members` | members added to a ticket |
| `discord_ticket_tags` | name, content, `trigger_keywords text[]` (substring match, not raw regex: no ReDoS), auto-reply scope |

Changes to existing tables:
- `discord_tickets`: `category` enum to text + composite FKs `(guild_id, category)` and `(guild_id, product)` with `ON UPDATE CASCADE ON DELETE RESTRICT`; new `close_code` (manual, inactivity, member_left, channel_deleted, force), `close_reason`, `priority`, `first_response_at`, `last_message_at`, `last_message_by_staff`, `stale_warned_at`, `close_requested_at/by/expects`, `references_ticket_id`, `references_message_url`, `created_by_discord_user_id`, `feedback_rating/comment/at`. `subject` and `description` stay NOT NULL: fall back to category name and joined answers.
- `discord_ticket_messages`: `deleted_at`, `pinned`.
- `discord_ticket_events`: widened type CHECK plus `target_discord_id`, `target_name`, `detail jsonb` (no user ids inside `detail`, so `delete_user_data` anonymises by column).
- `discord_ticket_settings`: `panel jsonb` (builder document + layout button/buttons/menu + button label/emoji), `messages jsonb` (close DM, stale warning, closing soon, close request, feedback prompt, working-hours notice), `blocked_role_ids`, `max_open_per_user`, `create_rate_limit_seconds`, `close_mode` (staff_only, request, either), `claim_hides_from_other_staff`, `dm_on_close`, `stale_after_hours`, `auto_close_after_hours`, `close_on_member_leave`, `working_hours jsonb`, `attachment_max_bytes`, `attachment_max_per_ticket`, `dm_open_enabled`, `defaults_seeded_at`.
- Dropped: `discord_tickets.scheduled_deletion_at` + `discord_tickets_pending_deletion_idx`. `github_issue_number` / `github_issue_url` stay as read-only history so old tickets keep their link on the detail page; nothing writes them any more.

Seeding: the migration backfills the current 4 categories and 8 products for every guild found in settings or tickets (needed before the FKs). `ensureTicketDefaults(guildId)` in TS adds form fields and copy, guarded by `defaults_seeded_at`, called from the save path, `/ticket-admin setup` and the wizard. Never on page load. jsonb settings are parsed with a zod schema whose defaults live in one object.

Transcript retention stays 12 months (fixed by the privacy policy), not a setting.

### Bot
- **Config cache**: `lib/tickets/config.ts`, one `TtlCache` (settings, categories, fields, products, tags; 60 s) replacing the ~12 uncached `getTicketSettings` calls; invalidated by `POST /cache/tickets` (pattern: `http/routes/cache.ts`).
- **Open flow**: category chosen before the modal (button per category, select menu, or single button then ephemeral select). Modal built from the category's fields. customIds `ticket:create:<slug>`, `ticket:submit:<slug>`. The legacy bare `ticket:create` button keeps working (shows the category select). Answers read by field uuid; a stale form asks the user to reopen.
- **Copy**: panel and opening message are `BuiltMessage` documents rendered with existing `lib/built-message.ts`; the bot appends ticket buttons. Other templates are text with the existing `[variable]` syntax from `@repo/discord-message` (`[ticket.number]`, `[ticket.category]`, `[member.mention]`, `[stats.avg_response]`), also in `channel_name_template`.
- **Staff**: `isStaff(member, settings, category)` = ManageGuild, or global staff role, or category staff roles.
- **Overwrites**: one pure `computeTicketOverwrites({category, settings, ticket, members, botId})` applied with `permissionOverwrites.set()` for open, claim, release, transfer, move, add, remove. Preflight check for Manage Roles/Manage Channels surfaced in `setup-status.ts` (pattern: `PUBLISH_PERMISSIONS` in `http/routes/built-messages.ts`).
- **Close**: single `finalizeTicketClose(ticket, {code, reason, actor, channel})` used by every close route. `actor` becomes nullable on `ticket.closed`; formatter says "System".
- **Commands**: `/ticket` (new, close, claim, release, add, remove, transfer, move, priority, rename, topic, transcript, list) gated by `isStaff` or opener, left unrestricted on the permissions page with a hint. `/ticket-admin` (setup, settings, force-close single + bulk) with `setDefaultMemberPermissions(ManageGuild)`. `/tag` top-level with autocomplete. Context menus: Create ticket from message, Create ticket for user, Pin message. Priority is not put in the channel name (2 renames per 10 min limit); rename/topic handle 429.
- **Live archive**: open-ticket cache becomes `channelId → {ticketId, number, openerId, categorySlug, imagesCopied}` and is checked before any DB work. One RPC `archive_ticket_message` per message (upsert + `last_message_*` + `first_response_at`, returns nothing). Edits update only content/embeds/edited_at; deletes and bulk deletes set `deleted_at`. R2 copy at message time reusing `copyImage`. Bot messages never touch activity or response metrics; the dashboard reply route sets them explicitly. Reconcile at close and at startup inserts only missing message ids; startup also closes tickets whose channel is gone (precedent: `reconcileVoiceSessions` in `events/ready.ts`).
- **Sweeper**: `lib/tickets/sweeper.ts` modelled on `lib/log-channel/worker.ts` (cancellable sleep, started in `ready.ts`, stopped in `index.ts`). Every action is a conditional claim (`UPDATE … WHERE stale_warned_at IS NULL RETURNING`), so it is restart-safe. Handles stale warning, closing soon, auto-close, expired close requests.
- **GitHub removal**: delete `handleGithubButton`, the `ticket:github` customId and the intro-message button; delete `apps/rest-api/src/handlers/github.ts` ticket sync and its route (whole handler if nothing else uses it); delete `setTicketGithubIssue`, `getTicketByGithubIssue`, `syncTicketStatusFromGithub`; delete `supabase/functions/sweep-ticket-deletions` and unschedule its pg_cron job; drop `GITHUB_APP_*` / `GITHUB_ISSUES_REPO` from bot and rest-api env schemas; remove `@repo/github-api` `createTicketIssue` (whole package if no other consumer). A stale `ticket:github` click on an old intro message gets a short "no longer available" reply.
- **Feedback**: rating buttons in the close DM (`ticket:feedback:<ticketId>:<n>`) then optional comment modal. Needs its own non-guild interaction path. No intent required.
- **Left out**: staff-offline notice (needs privileged GuildPresences intent; working hours covers the need). DM-to-open ships as an off-by-default toggle (needs DirectMessages intent).

### Web-admin
- `discord/tickets/settings/layout.tsx` subnav: General, Panel, Categories (list + editor with sortable form fields and opening message), Products, Messages, Automation, Tags.
- `discord/tickets/stats` on recharts, fed by SQL aggregate RPCs.
- Detail page: unclaim, close with reason, priority, add/remove member, move, transfer, rename, tag insert in reply box, answers, feedback, metrics. Open tickets read from DB; `lib/discord/live-transcript.ts` is deleted.
- List page: category/product options from DB, new filters priority and close code.

Reuse: `SettingRow`/`SaveBar` (`components/discord/setting-row.tsx`), `Picker`/`MultiPicker` (`components/discord/pickers.tsx`), `toChannelOptions`/`toRoleOptions` (`lib/discord/options.ts`), action order from `actions/discord-tickets.ts` (`requireDiscordAdmin`, zod, assert changed ids only, `callBot`, upsert, `recordChange`, `revalidatePath("/discord", "layout")`), CRUD template from `actions/discord-built-message.ts` + `hooks/use-autosave.ts`, child-row save from `saveLogRouting` (`packages/supabase/src/queries/platform-events.ts:183`), `chart-kit.tsx`, `StatCard`, `PageHeader`. Export a small `SortableList` from `@repo/ui` rather than adding dnd-kit to web-admin (mind the fixed `DndContext id` SSR note in `message-builder.tsx:68`).

## Phases
One PR each against `staging`. Migrations timestamped after `20260917100000`, applied `--local` only. `packages/supabase/src/types/supabase.ts` hand-edited per phase. User-facing copy follows `docs/tone_of_voice.md`.

**P0. Remove GitHub, refactor, orphan fix**
- GitHub removal as listed under Design. Before deploy, read-only check on staging and prod for rows with `scheduled_deletion_at IS NOT NULL`; any pending channel gets deleted by hand, since nothing will sweep it afterwards. Migration: guarded `cron.unschedule('sweep-ticket-deletions')` (`WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = …)`), drop `scheduled_deletion_at` + its index. Manual follow-up for the user: `supabase functions delete sweep-ticket-deletions` on remote projects, remove its `DISCORD_BOT_TOKEN` function secret, remove `GITHUB_*` vars from Doppler.
- Copy: remove the Move to GitHub button from the contact-page mock (`apps/web-streamwizard/src/components/public/contact/ticket-flow.tsx`), grep bot README, docs and privacy policy for GitHub ticket mentions.
- Split `apps/discord-bot/src/lib/tickets.ts` into `lib/tickets/{ids,panel,open,claim,close,events,index}.ts`; add `finalizeTicketClose`.
- Nullable `actor` on `ticket.closed`: `packages/types/src/platform-events.ts`, `log-channel/formatters.ts` + tests.
- `events/server-log/channelDeleted.ts` closes the ticket with `channel_deleted`.
- Migration: `close_code`, `close_reason`, `closed_at = COALESCE(closed_at, updated_at)` backfill, widened events CHECK + target/detail columns.

**P1a. Config foundation (backward compatible)**
- Migration in order: `category` to text, backfill categories + products, add FKs, drop enum type; `defaults_seeded_at`; audit CHECK gains action `create`.
- New `packages/supabase/src/queries/ticket-config.ts`; `DiscordTicketCategory` becomes `string`; remove `TICKET_PRODUCTS`.
- Bot: `lib/tickets/config.ts`, `/cache/tickets`, `isStringSelectMenu()` routing in `events/interactionCreate.ts`, category select for legacy button, slugged customIds.
- Web-admin: settings layout, Categories + Products pages, DB-driven labels and filters in `tickets/page.tsx` and `[number]/page.tsx`; delete `TICKET_CATEGORY_LABELS`.

**P1b. Forms, panel, copy**
- Tables `discord_ticket_form_fields`, `discord_ticket_answers`; `panel`, `messages`, `opening_message` jsonb.
- Ticket variables in `packages/discord-message/src/variables.ts`; Panel + Messages pages; form-field editor in category editor.
- `/ticket-panel` route renders from config; wizard (`lib/setup-wizard.ts`) and setup call `ensureTicketDefaults`; fix wizard writing `enabled: true` before config is complete.
- Contact-page mock: `apps/web-streamwizard/src/components/public/contact/ticket-section.tsx`, `ticket-flow.tsx`.

**P2. Gating, staff model, lifecycle**
- Per-category staff/ping/required roles, blocked roles, member/total limits, cooldown, rate limit, 50-channel guard.
- `lib/tickets/permissions.ts` (`computeTicketOverwrites`, preflight); `/ticket` + `/ticket-admin` split; `discord_ticket_members`; `events/server-log/memberLeft.ts` closes on leave when enabled.
- New bot routes in `http/routes/tickets.ts` (unclaim, close with reason, priority, members, move, transfer, rename); web-admin `actions/discord-ticket-actions.ts`, `components/discord/ticket-actions.tsx`; hint on permissions page; README API table.

**P3. Live archiving**
- RPC `archive_ticket_message`, `deleted_at`, `pinned`; partial indexes on `(guild_id, last_message_at)` and `(guild_id, opener_discord_user_id)` where open.
- `lib/tickets/archive.ts`; hooks in `events/messageCreate.ts`, `server-log/messageEdited.ts`, `messageDeleted.ts`, `messagesBulkDeleted.ts`; close + startup reconcile; richer cache in `lib/ticket-activity.ts`.
- Pure transcript-file generator, DM on close, `/ticket transcript`.
- Extend `delete_user_data` and `purge_old_discord_ticket_transcripts` (answers, members, feedback comment, close reason, new columns); privacy policy notes retained deleted messages.

**P4a. Sweeper**
- `lib/tickets/sweeper.ts`: stale warning, closing soon, auto-close; stale/auto-close fields on the Automation settings page.

**P4b. Close requests + working hours**
- Two-party close request with expiry, `close_mode`, force-close single and bulk, working-hours notice, Automation settings page.

**P5. Feedback + stats**
- DM rating buttons + comment modal, metrics variables, aggregate RPCs, `/discord/tickets/stats`.

**P6. Tags + context menus**
- Tags CRUD, `/tag`, keyword auto-reply (once per ticket via `tag_replied` event), tag insert in dashboard reply.
- Context menus: widen `Command` type in `types/discord.ts`, new dispatch branch with `canRunCommand`, widen `commandName` regex in `apps/web-admin/src/actions/discord-permissions.ts:15` (names contain spaces).
- DM-to-open behind `dm_open_enabled` (adds DirectMessages intent in `lib/discord-client.ts`).

## Verification
Per phase:
- `cd apps/discord-bot && bun test && bunx tsc --noEmit`; `cd apps/web-admin && bunx tsc --noEmit && bun run lint`; `cd packages/supabase && bun test`; `cd packages/discord-message && bun test`.
- New pure-function tests (no discord.js mocks, matching repo style): customId parsing, `computeTicketOverwrites`, template rendering, modal builder from fields, transcript file generator, working hours, sweeper due-selection, formatter cases for nullable actor and new event types.
- Migrations applied to the local DB only (ask before any `supabase db reset --local`; shared container across worktrees, use unique timestamps). Check the enum migration against existing local tickets: rows keep slugs, FKs hold, list filters work.
- Manual run in the dev guild with `doppler run --config dev_discord_bot` + `bun run dev:admin`, after `bun run deploy-commands`:
  - P0: delete a ticket channel by hand, row closes with `channel_deleted`, log embed says System. New tickets show no GitHub button; old ticket with an issue still shows its link on the detail page; `grep -ri github` over bot, rest-api and `packages/supabase/src/queries/tickets.ts` finds no ticket code; `select jobname from cron.job` locally no longer lists the sweep.
  - P1: old panel button still opens a ticket; add a category + field in web-admin, new panel reflects it without bot restart; archived category still labels old tickets.
  - P2: hit member limit and cooldown; claim/unclaim from Discord and dashboard; add/remove member changes overwrites.
  - P3: delete and edit messages in an open ticket, dashboard shows them flagged; restart bot mid-ticket, reconcile fills the gap; close DM carries the transcript file.
  - P4: shorten stale hours, watch warn then auto-close, restart bot between warn and close to confirm no double action; close request accept, reject and expiry.
  - P5: rate from the DM, stats page shows it.
  - P6: `/tag` autocomplete, keyword auto-reply fires once, context menus appear and respect permissions.
- Confirm `delete_user_data` on a local test user blanks every new user-data column.
