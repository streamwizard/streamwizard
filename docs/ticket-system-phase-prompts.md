# Ticket system: prompts for the remaining phases

Paste one block per new session, in order. Each assumes the previous phase is committed. Every prompt starts with the same context header so the session knows the ground rules without re-reading the whole plan.

---

## Shared header (copy into every prompt)

```
Context: StreamWizard monorepo (Bun/Turborepo). We are expanding the Discord ticket system to parity with github.com/discord-tickets/bot, everything configurable from web-admin, nothing hard-coded. Plan: docs/ticket-system-plan.md (read the Design + Phases sections). Memory: project_ticket_system_expansion.md.

Done so far, one commit per phase on stacked local branches off `clean-up` (nothing pushed, no PRs, do not push):
- P0 66851c24 feat/tickets-p0-foundation: GitHub integration removed, lib/tickets/ split, finalizeTicketClose, close codes, orphan close
- P1a 50285cc1 feat/tickets-p1a-config: discord_ticket_categories + discord_ticket_products, config cache (lib/tickets/config.ts, POST /cache/tickets), web-admin settings tabs
- P1b de5cd3b9 feat/tickets-p1b-forms: form fields + answers, designed panel, opening message (packages/discord-message/src/tickets.ts)
- P2 933d5cea feat/tickets-p2-lifecycle: gating (lib/tickets/access.ts), per-category staff, computeTicketOverwrites, /ticket + /ticket-admin, dashboard actions via ticketActionRoute in http/routes/tickets.ts
- P3 86e89fee feat/tickets-p3-archive: live archive (archive_ticket_message RPC, lib/tickets/archive.ts, ticket-activity.ts cached open-ticket map), startup + close reconcile (lib/tickets/reconcile.ts), close DM with transcript file (lib/tickets/close-dm.ts, transcript-file.ts), settings.messages jsonb parsed by parseTicketMessages, Messages tab in web-admin

Conventions to keep:
- Branch from the previous phase's branch, name feat/tickets-<phase>-<topic>, one commit at the end with an explanatory body. Do not push, do not open PRs.
- Migrations: new file supabase/migrations/2026091815xxxx_*.sql (timestamps after 20260918140000), apply with `supabase migration up --local` only; never touch remote. Hand-edit packages/supabase/src/types/supabase.ts for new columns/tables/functions (it is not regenerated).
- Queries live in packages/supabase/src/queries/ticket-*.ts and need an export-map entry in packages/supabase/package.json.
- Bot reads all config through getTicketConfig (TtlCache, 60s) invalidated by POST /cache/tickets; web-admin actions follow requireDiscordAdmin -> zod -> callBot -> upsert -> recordChange (action must be one of the CHECK-constrained values, use "update") -> revalidatePath("/discord","layout").
- Editable copy: short texts go into settings.messages via ticketMessagesSchema in packages/discord-message/src/tickets.ts with [variable] placeholders and a default; add variables to the right *_VARIABLES list and extend the Messages form (apps/web-admin/src/components/discord/ticket-messages-form.tsx).
- Tests: bun test with pure functions only (no discord.js mocks). Verify with `bunx tsc --noEmit` in apps/discord-bot, apps/web-admin, packages/supabase, packages/discord-message; `bun test` in the same; `bunx eslint` on touched web-admin files (the bot has no eslint config).
- Local DB: reachable via PostgREST using `supabase status -o env` (no docker/psql in this shell). Never print secret values. Ask before `supabase db reset --local`.
- Copy follows docs/tone_of_voice.md. Nothing live-tested in Discord so far; note that in the final report.
- Work autonomously; the user said "do all tasks, no need to wait". Finish with a short report: what changed, how it was verified, manual follow-ups.
```

---

## P4a: stale sweeper

```
<shared header>

Task: implement phase P4a, the stale-ticket sweeper, on branch feat/tickets-p4a-sweeper from feat/tickets-p3-archive.

Scope:
1. Migration: discord_ticket_settings gains stale_after_hours int null, auto_close_after_hours int null (both null = off; auto-close only counts from the stale warning); discord_tickets gains stale_warned_at timestamptz. Partial index on (guild_id, last_message_at) WHERE status='open' already exists (discord_tickets_open_activity_idx).
2. Bot lib/tickets/sweeper.ts modelled on lib/log-channel/worker.ts (cancellable sleep, started in events/ready.ts after the ticket reconcile, stopped in index.ts on shutdown). Interval 5 minutes. Per guild with tickets enabled: 
   - stale warning: open tickets with last_message_at older than stale_after_hours and stale_warned_at IS NULL. Claim with a conditional UPDATE ... WHERE stale_warned_at IS NULL RETURNING so a restart can't double-warn; then post the warning in the channel mentioning the opener.
   - closing soon / auto-close: tickets warned longer ago than auto_close_after_hours with no message since the warning (last_message_at <= stale_warned_at) get closed through closeTicketChannel-equivalent with code "inactivity", actor null, source "system". Reuse reconcileTicketTranscript + finalizeTicketClose from lib/tickets/close.ts.
   - a message after the warning clears stale_warned_at (hook in archive.ts where p_counts messages are archived: easiest is to make the archive_ticket_message RPC set stale_warned_at = NULL when p_counts is true; do it in the migration with CREATE OR REPLACE).
   - pure due-selection helper in lib/tickets/sweep-rules.ts with tests: given settings + ticket rows + now, return {warn: [...], close: [...]}.
3. Copy: two new entries in ticketMessagesSchema (staleWarning, autoClosed) with defaults using [ticket.number], [member.mention], [stale.hours], [close.hours]; add a TICKET_STALE_VARIABLES list; extend the Messages form with both textareas.
4. web-admin: new settings tab "Automation" (apps/web-admin/src/app/(monitor)/discord/tickets/settings/automation/page.tsx + components/discord/ticket-automation-form.tsx) with the two hour selects (Off, 12h, 24h, 48h, 72h, 7d, 14d) and a hint about the warning-then-close order; add to ticket-settings-nav.tsx; action in actions/discord-tickets.ts (extend the general schema or a dedicated saveTicketAutomation).
5. Detail page: show "Stale since <date>" badge when stale_warned_at is set; ticket list gets a "stale" filter option.
6. Platform event: ticket.closed already covers inactivity via close_code; formatter SYSTEM_CLOSE_CAUSES in lib/log-channel/formatters.ts must label "inactivity" sensibly (check it does).
7. README (apps/discord-bot/README.md) paragraph on the sweeper; types/supabase.ts hand-edits.

Verify: tsc + tests as in the header; a PostgREST check that the sweeper's conditional UPDATE is used (grep). Commit with a body explaining the restart-safety design.
```

---

## P4b: close requests + working hours

```
<shared header>
Also done: P4a (sweeper, Automation tab, staleWarning/autoClosed messages).

Task: implement phase P4b, two-party close requests and working hours, on branch feat/tickets-p4b-close-requests from feat/tickets-p4a-sweeper.

Scope:
1. Migration: discord_ticket_settings gains close_mode text NOT NULL DEFAULT 'staff_only' CHECK IN ('staff_only','request','either'), working_hours jsonb NOT NULL DEFAULT '{}' ; discord_tickets gains close_requested_at timestamptz, close_requested_by text, close_request_expires_at timestamptz. Extend discord_ticket_events type CHECK with close_requested, close_request_accepted, close_request_rejected, close_request_expired.
2. Semantics:
   - staff_only (today's behaviour): only staff close; opener sees no Close button.
   - request: the opener (and added members) can "Request close"; staff accept/reject via buttons on the request message; staff can still close directly. A request expires after settings-configurable hours (add close_request_hours int default 24); the sweeper (lib/tickets/sweeper.ts) closes expired requests with code "manual"? No: expired requests are cancelled, not closed; post "request expired" and clear the columns; event close_request_expired.
   - either: opener can close directly too (their own ticket only).
   - customIds ticket:close-request, ticket:close-accept, ticket:close-reject (parseTicketId in lib/tickets/ids.ts). intro.ts withTicketState renders the right buttons per mode (panel-rows/intro buttons). /ticket close respects the mode for non-staff.
   - web-admin detail page: shows pending request with accept/reject via the existing changeTicketFromDashboard pattern (add "close-accept"/"close-reject" to ticketActionRoute).
3. Working hours: working_hours jsonb = { timezone: IANA string, days: { mon: [{start:"09:00", end:"17:00"}], ... } }. Pure lib/tickets/working-hours.ts with tests: isWithinWorkingHours(config, now), nextOpening(config, now). When a ticket opens outside hours, the bot appends the workingHoursNotice message (new ticketMessagesSchema key, variables [hours.next_opening] as a Discord <t:unix:R> stamp) to the opening message. Do not use presence data.
4. web-admin: Automation tab gains close mode (radio), request expiry hours, and a working-hours editor (timezone select from Intl.supportedValuesOf("timeZone"), per-day ranges, up to 2 ranges/day). Messages form gains closeRequest + workingHoursNotice textareas.
5. Types, README, formatter labels for the new event types (lib/log-channel/formatters.ts + tests), types/supabase.ts.

Verify as in the header. Commit.
```

---

## P5: feedback + stats

```
<shared header>
Also done: P4a (sweeper), P4b (close requests, working hours).

Task: implement phase P5, opener feedback and a stats page, on branch feat/tickets-p5-feedback-stats from feat/tickets-p4b-close-requests.

Scope:
1. Migration: discord_tickets gains feedback_rating smallint CHECK 1..5, feedback_comment text, feedback_at timestamptz; discord_ticket_categories gains feedback_enabled boolean NOT NULL DEFAULT true. Extend delete_user_data (new versioned CREATE OR REPLACE) to null feedback_comment, close_reason when the closer is the deleted user, and anonymise discord_ticket_events.target_name/target_discord_id, discord_ticket_answers, discord_ticket_members for that Discord user (this was deferred from P3: check the current function body in the latest migration that defines it and keep every existing step). Extend purge_old_discord_ticket_transcripts to null feedback_comment after 12 months. Aggregate RPCs (SECURITY DEFINER, service_role only): ticket_stats_summary(p_guild_id, p_from, p_to) returning opened, closed, avg_first_response_seconds, avg_resolution_seconds, avg_rating, rating_count; ticket_stats_by_day(p_guild_id, p_from, p_to) returning day, opened, closed; ticket_stats_by_category(...) returning category, opened, avg_rating. Add all to types/supabase.ts Functions.
2. Bot: the close DM (lib/tickets/close-dm.ts) gets a row of 5 rating buttons ticket:feedback:<ticketId>:<n> when the category has feedback_enabled; clicking stores the rating (conditional UPDATE WHERE feedback_rating IS NULL and opener matches) and offers an optional comment modal ticket:feedback-comment:<ticketId>. These interactions arrive outside a guild: handleTicketInteraction in lib/tickets/index.ts currently assumes guild context, add a DM branch before it. Rating stored also emits a platform event ticket.feedback (packages/types platform-events + embed-kit + formatter + tests). New variables [stats.avg_response] and [stats.avg_rating] available in the opening message and closing DM (computed from ticket_stats_summary for the last 30 days, cached via TtlCache 5 min).
3. Messages form gains feedbackPrompt (text above the buttons) with default.
4. web-admin: /discord/tickets/stats page (add link in the tickets page header) on recharts through the existing chart-kit.tsx and StatCard: summary cards, opened/closed per day line chart, per-category table with rating, date range picker (7/30/90 days). Detail page shows the rating + comment when present. Category editor gets the feedback switch (ticket-category-rules-form.tsx + saveTicketCategoryRulesAction).
5. README, privacy policy (feedback comment retention), types.

Verify as in the header, plus a PostgREST call of ticket_stats_summary against local data. Commit.
```

---

## P6: tags, context menus, DM-to-open

```
<shared header>
Also done: P4a, P4b, P5.

Task: implement phase P6, the last one: tags, context-menu commands and the DM-to-open toggle, on branch feat/tickets-p6-tags-menus from feat/tickets-p5-feedback-stats.

Scope:
1. Migration: table discord_ticket_tags (id uuid, guild_id, name text max 32 unique per guild, content text max 2000, trigger_keywords text[] default '{}', auto_reply boolean default false, position int, created_at, updated_at) with RLS service_role + admin read like the other ticket tables; discord_ticket_settings gains dm_open_enabled boolean NOT NULL DEFAULT false; event type CHECK gains tag_replied. types/supabase.ts.
2. Queries packages/supabase/src/queries/ticket-tags.ts (list/create/update/delete/reorder, uniqueness on name) + export map. Tags join the ticket config cache (getTicketConfig) so the bot never queries per message.
3. Bot:
   - /tag <name> top-level command with autocomplete (commands/tag.ts), staff only (isStaff with no category), posts the content in the current channel with [variable] rendering (server + member variables).
   - Keyword auto-reply: in lib/tickets/archive.ts after archiving a person's message in an open ticket, match trigger_keywords case-insensitively as substrings (no regex from user input, ReDoS), reply once per ticket per tag (guard with a tag_replied event lookup cached per ticket in the open-ticket map, e.g. repliedTagIds Set). Record event tag_replied with detail {tag}.
   - Context menus: widen the Command type in types/discord.ts to allow ContextMenuCommandBuilder; new dispatch branch in events/interactionCreate.ts for isMessageContextMenuCommand / isUserContextMenuCommand using canRunCommand from the permissions layer; commands: "Create ticket from message" (opens category select then the modal, prefilling the description with the message text and storing references_message_url on the ticket: add column references_message_url text), "Create ticket for user" (staff only, opens a ticket on the target's behalf: created_by_discord_user_id column), "Pin message" (staff, pins in a ticket channel; the archive already tracks pinned). Register them in scripts/deploy-commands alongside the slash commands.
   - web-admin permissions page: the commandName regex in apps/web-admin/src/actions/discord-permissions.ts:15 must accept names with spaces; the list must show context menus with a hint.
   - DM-to-open behind dm_open_enabled: add Partials.Channel + GatewayIntentBits.DirectMessages in lib/discord-client.ts only when any guild has it on at startup (read settings once) or simply always add the intent and gate behaviour on the setting (choose the simpler: always add, gate on setting). In events/messageCreate.ts a DM from a user who shares the single guild starts the category select in the DM; the modal can't be shown from a plain message, so reply with a "Create ticket" button that opens it (customId ticket:create, existing flow, guild-less path needs guild lookup from env DISCORD_GUILD_ID or the settings row).
4. web-admin: settings tab "Tags" (CRUD list with SortableList from @repo/ui, keyword chips, auto-reply switch, live variable check); General form gains the DM-to-open switch with a hint that it needs the bot restarted; the dashboard reply box (components/discord/ticket-reply.tsx) gets an "Insert tag" dropdown that pastes the content.
5. README (commands table, tags, intents), privacy policy if DM content is now read (it is: mention that DMs to the bot are used only to open tickets), types.

Verify as in the header. Commit. Final report must list every manual follow-up across all phases: bun run deploy-commands; delete the sweep-ticket-deletions edge function and its DISCORD_BOT_TOKEN secret on remote projects; remove GITHUB_APP_*, GITHUB_ISSUES_REPO, GITHUB_WEBHOOK_SECRET from Doppler; check remote rows with scheduled_deletion_at IS NOT NULL before the P0 migration; enable the Message Content intent (already) and, if DM-to-open is used, the DirectMessages intent needs no portal toggle; consider squashing the six stacked branches into one PR against staging once clean-up itself has a PR.
```
