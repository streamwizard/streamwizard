# Ticket page on Supabase Realtime

Plan for making the web-admin ticket detail page client-driven: the server
renders one snapshot, the browser subscribes to row changes on the ticket
tables, and nothing polls or re-renders the page after that. Replaces the
ws-server "activity" push and the conversation poll added on 2026-09-18.

Status: all four phases built on 2026-09-18. The list page refreshes on guild
ticket changes (server-filtered list, so a refresh rather than row patching);
the bot's ws-server push, its env keys and the ws activity types are gone.
Date: 2026-09-18.

---

## 1. Why

Today the page is a server component. Every change (a message, a claim, a
category move) is shown by re-running the whole page: `router.refresh()` after
the admin's own action, on a ws-server push from the bot, and on a 15s/60s poll.
The 2026-09-18 work made that cheap (guild data cached, conversation pulled
through a server action), but it is still polling dressed up, and header,
details and timeline still need a full refresh.

Every change we care about is already a database write by the bot:

| Change | Write | Table |
|---|---|---|
| New message | `archive_ticket_message` RPC: INSERT, then UPDATE `last_message_at` on the ticket | `discord_ticket_messages`, `discord_tickets` |
| Edit, pin | UPDATE `content`, `embeds`, `edited_at`, `pinned` | `discord_ticket_messages` |
| Delete | UPDATE `deleted_at` (soft delete, never a DELETE) | `discord_ticket_messages` |
| Claim, release, close, move, rename, priority, close request, stale warning | UPDATE the ticket row | `discord_tickets` |
| Timeline entry | INSERT | `discord_ticket_events` |
| Member added or removed | INSERT or DELETE, plus a `member_added` / `member_removed` event | `discord_ticket_members`, `discord_ticket_events` |

So Postgres already knows everything the page needs. Supabase Realtime
`postgres_changes` streams those rows to the browser, filtered by ticket id
and gated by RLS. The bot stays out of it.

**Consequence:** the page becomes "snapshot + deltas". No poll, no ws-server
hop, no bot fan-out, no server re-render. The admin's own actions need no
refresh either: the bot writes the row, the row arrives.

## 2. What exists

- RLS admin SELECT policies (`check_user_role('admin')`) already exist on
  `discord_ticket_messages`, `discord_ticket_events`, `discord_ticket_members`,
  `discord_ticket_answers`, each with `GRANT SELECT ... TO authenticated`.
- `discord_tickets` has RLS on and **no policy, no grant**. The browser cannot
  read the ticket row today.
- Only `platform_events` is in the `supabase_realtime` publication. No ticket
  table is published. No `REPLICA IDENTITY` is set anywhere.
- Browser client: `@repo/supabase/next/client` (`createBrowserClient`, anon key,
  cookie session). web-admin already ships it (`use-ticket-activity.ts` uses it
  for the JWT) but never calls `.from()` or `.channel()` with it.
- One browser realtime pattern to copy:
  `apps/web-streamwizard/src/components/stream/ActivityFeed/ActivityFeedRealtimeListener.tsx`
  (`.channel(name).on("postgres_changes", { event, schema, table, filter }, cb).subscribe()`,
  `removeChannel` on cleanup).
- Guild names (channels, roles) are cached across requests in
  `apps/web-admin/src/lib/discord/api.ts`; people in
  `apps/web-admin/src/lib/discord/users.ts`; both combined by
  `apps/web-admin/src/lib/discord/ticket-names.ts`. All reused as-is.

## 3. Design

### 3.1 Database (one migration, local first)

```sql
-- Admins may read ticket rows from the browser (realtime respects this policy).
CREATE POLICY "Admins read discord tickets" ON "public"."discord_tickets"
    AS PERMISSIVE FOR SELECT TO "authenticated"
    USING ( ( SELECT "public"."check_user_role"('admin') ) );
GRANT SELECT ON TABLE "public"."discord_tickets" TO "authenticated";

ALTER PUBLICATION "supabase_realtime" ADD TABLE
    "public"."discord_tickets",
    "public"."discord_ticket_messages",
    "public"."discord_ticket_events";
```

Not published: `discord_ticket_members`. Its DELETE would only carry the
composite key and RLS cannot filter deletes, so member changes are tracked
through the `member_added` / `member_removed` events instead (section 3.3).
`discord_ticket_answers` never changes after opening.

No `REPLICA IDENTITY FULL`: we subscribe to INSERT and UPDATE only, and
filters on those use the new row.

Realtime evaluates the policy per subscriber per change. Admin count is tiny,
so the cost is nil. Any authenticated non-admin who subscribes gets nothing.

### 3.2 Snapshot

The server page keeps `force-dynamic`, `assertAdmin`, and its Supabase reads,
and hands everything to one client component as a plain object:

```ts
interface TicketSnapshot {
  ticket: DiscordTicket;                 // the row, whole
  messages: TranscriptMessage[];
  events: DiscordTicketEvent[];
  members: { id: string; name: string }[];
  names: Record<string, string>;         // from buildTicketNames
  profiles: Record<string, DiscordProfile>; // Map → Record for the boundary
}
```

Static config (categories, products, answers, tags, linked StreamWizard
account, `linked` flag, `wsUrl`) is passed as separate props. It changes so
rarely that a page load is the right time to read it.

A server action returns the same shape on demand:

```ts
getTicketSnapshot(ticketNumber): Promise<({ error: null } & TicketSnapshot) | { error: string }>
```

Used for: resync after the realtime channel reconnects, the manual refresh
button, and the fallback poll when the channel is not subscribed. Replaces
`getTicketConversation`.

### 3.3 Store

`apps/web-admin/src/components/discord/ticket-page/use-ticket-store.ts`: a
`useReducer` over `TicketSnapshot` with these actions:

| Action | Source | Effect |
|---|---|---|
| `snapshot` | server action | replace everything |
| `ticket` | `discord_tickets` UPDATE | replace `ticket` |
| `message` | `discord_ticket_messages` INSERT or UPDATE | upsert by `id`, keep `created_at` order |
| `event` | `discord_ticket_events` INSERT | append by `id`; if `type` is `member_added` / `member_removed`, mark members stale |
| `names` | mention lookup | merge |

Members: when marked stale, the store calls a small action
`listTicketMembersForDashboard(ticketNumber)` and replaces the list. Rare, one
Supabase read.

Names: a new message or event may mention an id the snapshot never resolved.
The transcript already falls back to `@unknown`; the store collects unknown
ids from incoming rows and calls `lookupDiscordNames(ids)` (thin wrapper over
`resolveDiscordProfiles`, cached server side), then merges. Debounced, at most
one call per burst.

Closed ticket: the store still mounts, but no channel. A ticket that closes
while open (an UPDATE with `status = 'closed'`) flips the page to the closed
layout in place.

### 3.4 Realtime hook

`apps/web-admin/src/hooks/use-ticket-realtime.ts`:

```ts
useTicketRealtime(ticketId: string | null, dispatch): "subscribed" | "connecting" | "off"
```

- `createBrowserClient()` per mount (matches the existing listener).
- One channel `ticket:<id>` with three `postgres_changes` listeners:
  - `{ event: "UPDATE", table: "discord_tickets", filter: `id=eq.${ticketId}` }`
  - `{ event: "*", table: "discord_ticket_messages", filter: `ticket_id=eq.${ticketId}` }` (INSERT and UPDATE; a DELETE never happens)
  - `{ event: "INSERT", table: "discord_ticket_events", filter: `ticket_id=eq.${ticketId}` }`
- `subscribe((status) => ...)`: on `SUBSCRIBED` after a previous drop, dispatch a
  fresh `getTicketSnapshot` so nothing missed during the gap is lost. On
  `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED`, report status; supabase-js
  reconnects on its own.
- `removeChannel` on cleanup.
- The session JWT must reach the realtime socket: `createBrowserClient` does this
  through `onAuthStateChange`; the hook also calls
  `supabase.realtime.setAuth(session.access_token)` after `getSession()` so the
  first subscribe is already authenticated (otherwise RLS sees `anon` and the
  channel gets nothing, silently).

Fallback: while status is not `subscribed`, a 30s snapshot poll runs (visible
tab only). Same safety net as today, only when needed.

### 3.5 Components

`apps/web-admin/src/components/discord/ticket-page/`:

- `ticket-page.tsx` (client) owns the store and the hook, renders the layout
  that `page.tsx` renders today: header, conversation card, sidebar.
- `ticket-header.tsx`: title, product · category, `TicketActions`, "Open in
  Discord". Reads `ticket` from the store.
- `ticket-details.tsx`: the Details card. `DiscordPerson` and `displayName`
  move here and take `profiles: Record`.
- `ticket-timeline.tsx`: the Timeline card, `EVENT_LABELS` and `eventChange`
  move with it. Keeps the "rebuild from the row" fallback for tickets without
  events.
- `ticket-conversation.tsx`: trimmed to transcript + reply + status pill. The
  pill shows Live / Reconnecting / Polling from the hook status, plus the
  manual refresh button.
- `TicketActions`, `TicketManage`, `TicketCloseRequest`, `TicketReply`: drop
  every `router.refresh()`. They call their action, show the toast, and wait
  for the row. `TicketManage` no longer needs the remount `key`; its form
  resets from the store's `ticket` when it changes.

`page.tsx` shrinks to: auth, reads, `buildTicketNames`, `<TicketPage snapshot
config />`. No client-facing logic left.

### 3.6 What goes away

- `getTicketConversation`, the `TicketConversation` component from
  2026-09-18, and `AutoRefresh` on the ticket page (the list page keeps it).
- `useTicketActivity` on the ticket page. Stays for the list page until
  section 5.
- `revalidatePath("/discord/tickets/<n>")` in the ticket actions: the page is
  dynamic and nobody re-renders it. `revalidatePath("/discord/tickets")` stays
  for the list.

## 4. Phases

### Phase 1: database and a proof

1. Migration (unique timestamp, `supabase migration up --local` or `docker exec
   psql` per the worktree rule) with the policy, grant and publication.
2. Throwaway script (scratchpad, not committed): sign in as the local admin
   smoke user, `setAuth`, subscribe to the three listeners for a local ticket,
   then insert a `discord_ticket_events` row and update the ticket through
   PostgREST with the service key. Expect both to arrive. Then run the same
   script as a non-admin user and expect silence. This is the gate: if RLS on
   realtime does not behave, stop here.

### Phase 2: snapshot and store

3. `getTicketSnapshot`, `listTicketMembersForDashboard`, `lookupDiscordNames`
   in `apps/web-admin/src/actions/discord-ticket-actions.ts`.
4. `use-ticket-store.ts` with the reducer; a `bun test` for the reducer
   (upsert order, event append, member staleness, names merge). web-admin has
   no test script yet: add `"test": "bun test"`, `@types/bun` is already there.
5. `use-ticket-realtime.ts`.

### Phase 3: the page

6. Split `page.tsx` into the components in 3.5. Move, do not rewrite, the JSX.
7. Remove the refreshes from the action components; remove
   `TicketConversation` and `getTicketConversation`.
8. Closed tickets: same client page, no channel, no pill.

### Phase 4 (optional): list page

9. Subscribe the list page to `discord_tickets` INSERT/UPDATE with
   `guild_id=eq.<id>` and patch rows in place instead of `router.refresh()`.
10. Then delete `notifyTicketActivity` in the bot, the
    `streamwizard.discord_ticket_activity` channel in ws-server, the
    `DiscordTicketActivityPayload` type and `use-ticket-activity.ts`.

## 5. Verification

- Phase 1 script: admin receives event INSERT and ticket UPDATE within a
  second; non-admin receives nothing; Supabase logs show no policy errors.
- `cd apps/web-admin && bunx tsc --noEmit`, `bunx eslint src`, `bun test`.
- Headless (Playwright, admin cookie, ticket flipped open locally): load the
  page, confirm the pill reads Live, then through PostgREST insert a message
  row, update `priority`, insert a `priority_changed` event, insert a
  `member_added` event. Expect: transcript grows, header/details update,
  timeline grows, members list refetched, and the Network tab shows no
  `next-action` POST for any of it except the members refetch. No RSC GET.
- Dashboard actions: rename, move, claim, reply. Each shows the result via the
  row, no refresh, and the form does not lose focus or draft.
- Kill ws-server: nothing changes on the ticket page (it no longer uses it).
- Drop the socket (devtools offline for 20s, back online): pill goes
  Reconnecting then Live, a snapshot resync lands, changes made while offline
  appear.
- Closed ticket page renders as before; a ticket closed from Discord while
  open flips to the closed layout in place.
- Staging: after `db push`, open a real ticket, post from Discord, confirm the
  page moves without the bot's ws push (temporarily unset `WS_SERVER_URL` on
  the staging bot to prove it).

## 6. Risks

- **RLS on realtime** is the one unknown. Realtime evaluates policies with the
  subscriber's JWT; `check_user_role` reads `auth.uid()`, which is set for
  realtime. Phase 1 proves it before anything else is built.
- **Missed rows during a reconnect**: covered by the resync on `SUBSCRIBED`.
- **Bursty tickets**: each row is one small frame; the reducer upserts by id,
  so duplicates or out-of-order frames are harmless.
- **Realtime egress**: rows are small and only open admin tabs subscribe.
  Nothing like the earlier per-request egress problem.
- **Two Supabase clients in the browser** (`createBrowserClient` per mount vs
  the `supabase` singleton): fine for now, matches web-streamwizard. Could be
  unified later.
