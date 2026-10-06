# Admin redesign plan: structure, navigation and mobile

Status: approved 2026-10-04. No code written yet.

Paths are relative to `apps/web-admin/src/` unless they start with `packages/` or `docs/`.

## Context

The admin app (`apps/web-admin`) grew page by page. It now has 60 routes behind a flat sidebar of 30 items in 9 groups. The dashboard repeats numbers from three other pages and links nowhere. Most pages have no responsive classes, so the app is hard to use on a phone.

Goal: reorganise what lives where, make the dashboard answer "is anything wrong, and what needs me", and make every page usable on a phone.

Not in scope: colours, branding, component library. Those stay. No route URLs change, with one exception (`/subscriptions`, which redirects to Users).

## Summary of the proposal

- Sidebar goes from 30 items in 9 groups to 17 items in 5 groups. Sub-pages become tabs inside their page.
- Dashboard becomes: needs attention, system status, four key numbers (live streamers and Cloud OBS load), live now, shortcuts.
- Phones get a bottom bar (Home, Tickets, Alerts, Users, More) and tables turn into card lists.
- Four desktop tools stay desktop only and show a short notice on phones: message builder, WebSocket topology, WebSocket live feed, VNC.
- Eight phases, plus one optional. Phases 1 to 4 fix the shell, the navigation and the dashboard. Phases 5 to 8 go area by area.

---

## Step 1: Audit

### Shell and navigation

| Finding | Where |
|---|---|
| 30 flat nav items, 9 groups, no nesting, no counters | `lib/nav-config.ts:47-119` |
| Alerts and WebSocket each use 4 sidebar slots for sub-pages of one area | `nav-config.ts:60-67, 93-100` |
| Discord uses 9 slots; `/discord` hub repeats 6 of them as cards | `nav-config.ts:102-114`, `app/(monitor)/discord/page.tsx:108-167` |
| "Overview" and "Account" are one-item groups; Security is also in the user menu | `nav-config.ts:49, 116`, `components/nav-user.tsx:44` |
| Breadcrumb is two levels, not clickable, and never shows detail pages | `components/monitor-header.tsx:25-39` |
| Header has three controls (bandwidth, range, refresh) that do nothing on about half the pages | `monitor-header.tsx:40-47` |
| No firing-alert count, ticket count or review count anywhere in the shell | `components/monitor-sidebar.tsx` |
| Nav labels and page titles disagree ("Widget Review" vs "Widget Moderation", "WS Metrics" vs "WebSocket", "Server" vs "Discord") | nav config vs page titles |
| Five different sub-nav styles, five back-link styles, three page-title styles | see per-area notes |
| No shared table component. 35 hand-built tables, 4 hand-built paginations | all pages |
| 16 route families are only reachable through a link inside a table cell or a small header button | listed below |

Mobile state of the shell:

- Sidebar already becomes a drawer below 768px, but it does not close after you tap a link.
- Header controls have fixed widths and no small-screen layout.
- Content padding is a fixed `p-6`. No `min-w-0`, so wide content can push the page sideways.
- 37 of 61 pages have no responsive classes at all.
- `/login` and `/no-access` have no outer padding.

### Page inventory

**Home**

| Route | Shows | Actions | Problems |
|---|---|---|---|
| `/overview` | 4 system stats, 4 database stats, live streamers table | None, no links | 8 of 8 stat cards repeat `/ws`, `/http`, `/database`. Request total is computed differently than on `/http`. No alerts, tickets, backups or node health. Fixed 4-column grid. |

**Support (people)**

| Route | Shows | Actions | Problems |
|---|---|---|---|
| `/users` | 4 stats, search, filter, sort, 5-column table | Row opens user | Fine structure. Table scrolls sideways on a phone. |
| `/users/[id]` (+ 5 tabs) | Profile header, 6 cards on Overview; Plans, EventSub, Tickets, Discord, Activity tabs | Make/remove admin, ban, lift ban, delete, remove 2FA, grant/edit/revoke plan, resync EventSub, unlink Discord | Ban and delete sit in the 6th card. Lift ban sits somewhere else (banner). User tickets tab is a weaker copy of the ticket list. |
| `/subscriptions` | Every user in one table with plan chips | Grant, edit, revoke | Duplicates `/users` plus the user Plans tab. Loads all users, no pagination. 28px icon targets. |
| `/widget-library` | Card grid of pending widgets with live preview | Approve, reject | Reject deletes with no confirm. Errors are not shown. No pending count in nav. |
| `/discord/tickets` | 5 view tabs, up to 9 filters, 7-column table | Open ticket. Stats and Settings buttons | Claim and close are not possible from the list. Stats and Settings are hidden behind small buttons. |
| `/discord/tickets/[number]` | Conversation, reply box, Details, Close request, Manage, Timeline | Claim, release, close, reply, priority, category, members, hand over | On a phone the reply box sits under the whole transcript and above four more cards. Timestamps are hover only. Priority and category change with no confirm. |
| `/discord/tickets/stats` | 5 stats, chart, per-category table | Range | Buried. |
| `/discord/tickets/settings` (7 tabs + category editor) | General, Panel, Categories, Products, Messages, Automation, Tags | Many forms | 2 to 4 clicks deep. Related settings split across tabs (toggle in one tab, its text in another). Category editor has three save bars. |

**Discord (community)**

| Route | Shows | Actions | Problems |
|---|---|---|---|
| `/discord` | Guild card, 6 feature cards, recent changes | Links only | Feature cards repeat the sidebar. No card for Messages or Announcements. |
| `/discord/welcome`, `/activity`, `/live`, `/permissions` | One settings form each (live also has two tables) | Save, test, create role | Four sidebar slots for four small forms. "Activity" is settings, not a log. Two save bars on Go-live. |
| `/discord/announcements` (+ editor) | List, then form with preview | Post, schedule, update, delete | No filter or paging. On a phone the Post button is at the top and the preview is under the whole form. |
| `/discord/messages` (+ builder) | List, then inline builder | Publish, delete, drag elements | Builder relies on hover and drag. Hardest page on a phone. |
| `/discord/logs` | Filters, 7-column table | None | No user filter, no link to the user. Details are cut off with no way to expand. |
| `/discord/logs/settings` | About 120 controls in 12 cards | Save, test | Buried behind one button. One long scroll. |

**Monitoring**

| Route | Shows | Actions | Problems |
|---|---|---|---|
| `/alerts` | 3 stats, firing table (7 columns) | Silence 1h/8h/24h | Not visible anywhere else in the app. Message is cut off, full text hover only. |
| `/alerts/history` | Event log table | Paging | No filter. |
| `/alerts/rules` | One table per rule group, edited inline | Save, reset | Inputs inside table cells. Reset has no confirm. |
| `/alerts/notifications` | 3 environment cards | Save, test | Fixed 5-track grid that collapses on narrow screens. |
| `/http` | 3 stats, latency chart, top routes | None | Fixed grid. Subtitle says "Last 24 hours" even when the header range differs. Stats never refresh. |
| `/eventsub` | Health banner, 6 tiles, shards, charts, tables | Open shard detail | Mostly responsive already. Heatmap detail is hover only. |
| `/ws`, `/ws/live`, `/ws/rooms`, `/ws/topology` (+ room) | Metrics, live event feed, room table, node graph | Pause, clear, filters, graph pan/zoom | Four sidebar slots. Rooms and total connections shown on three pages from two sources. No responsive classes. Live feed has a 490px fixed row. Rooms do not link to the room graph. |
| `/database` | 13 row-count cards | None | Fixed 3 and 5 column grids. Sits next to `/supabase` under "Data" with a confusing split. |
| `/supabase` | Banner, 6 tiles, 14 charts, 3 tables | None | Most cluttered page (24 blocks). Already responsive. |

**Infrastructure**

| Route | Shows | Actions | Problems |
|---|---|---|---|
| `/obs` | 4 stats, 4 tables, 11 charts | Add, edit, delete node | Nodes appear in 3 separate tables. Node management is the second section with no anchor. No responsive classes. |
| `/obs/[nodeId]` | Node facts, live metrics, instances, 7 history charts | Create test instance, VNC, start/stop, remove | Only reachable from a name link. Remove uses a browser `confirm()`. CPU/RAM/GPU shown three times. |
| `/obs/[nodeId]/instances/[instanceId]` | 4 tabs: Overview, Metrics history, A/V sync, Auto Switcher | VNC, start/stop, scene hold, switcher config | Three levels deep. |
| `/vnc` | Full-screen remote desktop | Remote control, clipboard | Opens as a 1280x800 popup. Desktop tool. |
| `/ingest` | 7 stats, 5 tables, 9 charts | Add, edit, delete node | Nodes in 3 tables, streams in 2 tables with different loss thresholds. |
| `/vms` (+ host, + VM detail) | Host cards, 12-column VM table; detail has 6 stats and 11 to 13 charts | Per-VM alert switches | 12-column table. On a phone the alert switches land under all the charts. No link to backups. |
| `/backups` (+ VM detail) | Banner, 7 tiles, 10-column table, 3 charts, hosts, webhooks | Poll now | No link to the VM page. Hosts listed here and on `/vms`. |

**Account**

| Route | Shows | Actions | Problems |
|---|---|---|---|
| `/security` | 2FA and passkeys | Add, rename, remove | Fine. Reachable three ways. |
| `/login`, `/auth/setup`, `/auth/verify`, `/no-access` | Auth cards | Sign in, enrol | Two of four lack outer padding. |

### Duplicated

- Dashboard stats repeat `/ws`, `/http` and `/database`.
- `/subscriptions`, `/users` (plan badges and filter) and the user Plans tab all manage the same plans.
- `/discord/tickets` and the user Tickets tab are two builds of the same list.
- `/discord` feature cards repeat sidebar items.
- OBS nodes in 3 tables, ingest nodes in 3 tables, ingest streams in 2 tables.
- Health banners on `/supabase`, `/eventsub`, `/backups` are computed apart from the alert engine and can disagree with `/alerts`.
- Helpers: 2 sparklines, 2 chart kits, 4 relative-time helpers, 3 copies of the pill-tab markup.

### Buried

- Ticket settings, ticket stats, log settings: behind small header buttons.
- Category form editor: 4 clicks.
- Ban, delete, remove 2FA: bottom of the user Overview.
- Node, instance, host and VM detail pages: only through a table-cell link.
- Node management on `/obs` and `/ingest`: second section, below a table.
- Firing alerts: only visible if you open `/alerts`.

### Cluttered (worst first)

1. `/discord/logs/settings`: about 120 controls
2. `/supabase`: 24 blocks
3. `/vms/[host]/[vmid]`: 22 to 24 blocks
4. `/ingest`: 21 blocks
5. `/obs`: 19 blocks
6. `/discord/tickets/[number]`: 5 to 6 cards, about 12 actions

---

## Step 2: New structure

### Navigation

Five groups, 17 items. Sub-pages become tabs at the top of their page. All URLs stay the same.

| Group | Item | Route | Tabs inside the page | Badge |
|---|---|---|---|---|
| Home | Dashboard | `/overview` | | |
| Support | Tickets | `/discord/tickets` | Queue, Stats, Settings | Needs reply |
| Support | Users | `/users` | | |
| Support | Widget review | `/widget-library` | | Pending |
| Discord | Announcements | `/discord/announcements` | | |
| Discord | Messages | `/discord/messages` | | |
| Discord | Event log | `/discord/logs` | Log, Routing (was `logs/settings`) | |
| Discord | Server settings | `/discord` | Overview, Welcome, Activity tracking, Go-live, Permissions | Not set up |
| Monitoring | Alerts | `/alerts` | Active, History, Rules, Notifications | Firing |
| Monitoring | API | `/http` | | |
| Monitoring | EventSub | `/eventsub` | | |
| Monitoring | WebSocket | `/ws` | Metrics, Live feed, Rooms, Topology | |
| Monitoring | Database | `/supabase` | Health (`/supabase`), App data (`/database`) | |
| Infrastructure | OBS nodes | `/obs` | Fleet, Manage | |
| Infrastructure | Ingest servers | `/ingest` | Fleet, Live, Manage | |
| Infrastructure | VMs | `/vms` | | |
| Infrastructure | Backups | `/backups` | | |

What changed and why:

- **Tickets moved out of Discord into Support.** It is daily work, not Discord configuration. Stats and Settings become tabs, so they are one tap away, not hidden buttons.
- **Subscriptions folded into Users.** One place to find a person and manage their plan. "Grant access" becomes a row action on the user list and stays on the user Plans tab. `/subscriptions` redirects to `/users?filter=paying`.
- **Welcome, Activity, Go-live, Permissions folded into Server settings.** Four small forms that are set once. The `/discord` overview stays as the first tab and drops the duplicate feature cards for a short status list.
- **Alerts: 4 items to 1.** Active is what you check; the rest is setup.
- **WebSocket: 4 items to 1.**
- **Database + Supabase: 2 items to 1.** "Health" is the Postgres view, "App data" is the row counts.
- **Security leaves the sidebar.** It stays in the user menu, which is where personal settings belong.
- **Labels in sentence case** (branding rule), and each page title matches its nav label.

Other shell changes:

- **Breadcrumb** shows the real trail with links, for example `Support / Users / jochem / Plans`. On a phone it is a back arrow plus the page title.
- **Header controls** (range, refresh, bandwidth) show only on pages that use them. On a phone they collapse into one "View" button.
- **Counters** on Tickets, Alerts and Widget review in the sidebar and bottom bar.
- **One tab component** replaces the five current styles.

### Dashboard

One question per section. Top to bottom:

| # | Section | Content | Why it earns its place |
|---|---|---|---|
| 1 | Needs attention | One list, worst first: firing alerts, tickets waiting for a reply, widgets waiting for review, failed clip syncs, Discord features not set up. Each row links to the place to fix it. Empty state: "All clear." | The only things that require action. Today none of them are on the dashboard. |
| 2 | System status | One chip per subsystem: API, WebSocket, EventSub, Database, OBS nodes, Ingest, VMs, Backups. Green, amber or red. Each chip links to its page. | Answers "is it up" in one glance. Driven by alert-engine state grouped by rule group (`packages/alerting/src/rules.ts:43`), so it always agrees with `/alerts`. |
| 3 | Key numbers | Four tiles: live streamers, total viewers, running OBS instances, GPU node usage. The first two link to Live now, the last two to OBS nodes. | The two things you asked to see at a glance: who is live and how loaded Cloud OBS is. Four, so they fit a 2x2 grid on a phone. |
| 4 | Live now | Who is live: name, category, viewers, duration. Rows link to the user page. | Unique to the dashboard and useful before doing risky work. |
| 5 | Shortcuts | Answer tickets, Check alerts, Find a user, Grant access. | Your most common tasks in one tap. |

What moved off the dashboard:

| Item | Goes to | Reason |
|---|---|---|
| Total clips, Active overlays, Enabled commands | Database, App data tab | Inventory numbers. Nothing to act on. |
| Failed syncs | Needs attention, only when above zero | A zero is not worth a tile. |
| Auth failures (1h) | Covered by the WebSocket status chip and alert | Same reason. |
| Active WebSocket connections | WebSocket page (already there) | Not one of the numbers you picked. |
| Total requests, Avg latency | API page | Detail, and today the total disagrees with `/http`. |

### Per-page priorities

Listed top to bottom in the order each page should show them.

**Support**

- **Tickets, Queue**: view tabs with counts; search; ticket list (subject, status, priority, who, last activity) with a Claim action on unclaimed rows; filters.
- **Ticket**: status and primary actions (Claim, Close); conversation; reply box; close request if one exists; then Details, Manage, Timeline as secondary panels.
- **Tickets, Stats**: range; 5 stats; chart; by category.
- **Tickets, Settings**: General first. Move each text next to its toggle (for example "DM on close" text with the switch). Category editor gets one save bar.
- **Users**: search; filter; list with plan and role badges and a row menu (Grant access, Open); stats row below the search on phones.
- **User**: identity and status; an Actions menu (Grant access, Ban or Lift ban, Make admin, Unlink Discord, Resync EventSub, Delete); tabs. Overview order: Account, Plans summary, Twitch, Recent activity, Usage, Sign-in and security. The danger zone card goes away because its actions live in the menu.
- **User, Tickets tab**: reuse the main ticket list component, filtered to this user.
- **Widget review**: pending count; cards with preview, Approve, Reject (with confirm and visible errors).

**Discord**

- **Announcements**: New button; list with status. Editor: content fields, then target and timing, then preview; Post and Schedule in a bar that stays in view.
- **Messages**: New button; list with status. Builder: name and channel, builder, Publish.
- **Event log**: filters; list with expandable details; subject links to the user. Routing tab: default channel, then one collapsible section per event group.
- **Server settings**: Overview shows guild, a status row per feature (on, off, not set up) and recent changes. Each other tab is one form with one save bar.

**Monitoring**

- **Alerts, Active**: firing list with Silence; counts; watched total. History: filter by severity and rule; list. Rules: grouped list, edit one rule at a time. Notifications: one card per environment.
- **API**: stats that refresh with the charts; latency chart; top routes.
- **EventSub**: health banner; tiles; shards; subscription inventory; throughput; lifecycle.
- **WebSocket**: Metrics tab keeps stats and charts. Live feed, Rooms and Topology keep their content; Rooms rows link to the room graph.
- **Database, Health**: banner; saturation tiles; then Load, Resources, Efficiency, Top queries, Auth and storage as collapsible sections. App data: the 13 counts in four groups.

**Infrastructure**

- **OBS nodes, Fleet**: stats; one node table (registry, health and live metrics merged from three); running instances linking to the instance page; charts. Manage: add, edit, delete.
- **OBS node**: status and actions; instances; live metrics; node facts; history.
- **Instance**: tabs stay. Remove action added here.
- **Ingest servers, Fleet**: stats; one node table; charts. Live: streams (one table, one set of thresholds) and bandwidth. Manage: add, edit, delete.
- **VMs**: host cards; VM list with status, CPU, RAM, alerts; other VMs collapsed. VM detail: status; alert switches; stats; charts. Link to this VM's backups.
- **Backups**: status banner; tiles; VM list; charts; hosts and webhooks. VM detail links back to the VM page.

---

## Step 3: Mobile approach

### Shared patterns

| Topic | Rule |
|---|---|
| Breakpoints | Phone below 640px, tablet 640 to 1023px, desktop from 1024px. Sidebar switches at 768px (existing). |
| Navigation | Bottom bar below 768px with 5 slots: Home, Tickets, Alerts, Users, More. "More" opens the full nav drawer. Counters on Tickets and Alerts. Shown with CSS (`md:hidden`), not JS, to avoid a flash. |
| Page frame | `p-4` on phones, `p-6` from 768px. `min-w-0` on the content column. Bottom padding for the bar plus the safe-area inset. The page never scrolls sideways. |
| Header | Back arrow, page title, environment badge, one "View" button for range, refresh and bandwidth (only on pages that use them). |
| Tabs | One scrollable row. The active tab scrolls into view. |
| Tables | Below 640px each row becomes a card: title line, status badge, two or three key fields, a "more" menu for actions. Tapping a card opens the detail page or a drawer with all fields. Read-only reference tables (top queries, top routes) keep two columns and hide the rest. |
| Stat cards | Two per row on phones, never more. |
| Charts | One per row, 180px tall. Tap for the tooltip. On heavy pages chart sections start collapsed. |
| Forms | One column, labels above, 16px text in inputs (stops iOS zoom). One save bar per page, fixed above the bottom bar while there are unsaved changes. |
| Dialogs | Become bottom drawers on phones (vaul drawer already exists in `@repo/ui`). |
| Filters | Search stays visible. Other filters go in a "Filters" drawer with a count of active ones. |
| Touch targets | 44px minimum. Icon-only buttons get labels or move into a menu. |
| Hover-only info | Every `title`-only hint becomes visible text or a tap-to-open popover. |
| Drag and drop | Every sortable list also gets Move up and Move down. |
| Desktop-only tools | Message builder, WebSocket topology, WebSocket live feed and VNC show a short notice below 768px ("This tool needs a larger screen") with a link back. Their list pages and the pages around them stay fully usable. |
| Destructive actions | Always a confirm dialog. No browser `confirm()`. |

### Per page

| Page | On a phone | Actions that matter most |
|---|---|---|
| Dashboard | Sections stack in order. Status chips wrap in two columns. Live now becomes cards. Shortcuts as a 2-column grid of large buttons. | Open an alert, open tickets |
| Tickets, Queue | Card per ticket. View tabs scroll. Claim button on the card. Filters in a drawer. | Claim, open |
| Ticket | Conversation fills the screen. Reply box fixed at the bottom. Claim and Close in the header. Details, Manage and Timeline open from a "Details" button as a drawer. Timestamps always visible. | Reply, claim, close, accept close request |
| Tickets, Stats | Stats 2 per row, chart, category cards. | Change range |
| Tickets, Settings | Tabs scroll. Forms in one column. Working-hours rows wrap. Sortable rows get a menu (Edit, Move up, Move down, Remove). | Toggle accepting tickets, re-post panel |
| Users | Search on top. Card per user with badges. Row menu. | Search, open, grant access |
| User | Compact header; IDs behind a "Copy IDs" menu. Actions menu in the header. Tabs scroll. Cards stack. | Ban, lift ban, grant access |
| Widget review | One card per row, large Approve and Reject. | Approve, reject |
| Announcements | Card list. Editor: Edit and Preview as two tabs, Post bar fixed at the bottom. | Post now, schedule |
| Messages | Card list with status works on a phone. Opening the builder shows the desktop-only notice. Same for the builder cards in ticket Panel and category Opening message; the rest of those forms work. | See what is published |
| Event log | Card per event, tap to expand. Filters in a drawer. Routing: one collapsed section per group, group switch on the section header. | Filter, read |
| Server settings | Tabs scroll. One-column forms. One fixed save bar. | Toggle a feature |
| Alerts, Active | Card per alert: severity, rule, entity, full message, Silence button. | Silence |
| Alerts, History | Card per event. Filters in a drawer. | Read |
| Alerts, Rules | List of rules; tap one to edit in a drawer. | Enable or disable a rule |
| Alerts, Notifications | Each channel row stacks: destination, severity, Test. | Send test |
| API | Stats 2 per row, chart, routes as two-column list. | Read |
| EventSub | Already close. Heatmap cells open the shard drawer on tap. Strip view hidden on phones. | Read, open shard |
| WebSocket, Metrics | Stats 2 per row, charts stacked. | Read |
| WebSocket, Live feed | Desktop-only notice. | None |
| WebSocket, Rooms | Card per room. This is the phone view of what Topology shows. | Read |
| WebSocket, Topology | Desktop-only notice, with a link to Rooms. | None |
| Database | Health: banner and tiles, sections collapsed. App data: 2 per row. | Read |
| OBS nodes | Stats 2 per row. Card per node: name, health, GPU, instances. Charts collapsed. Manage: card per node with labelled Edit and Delete. | Check health, open node |
| OBS node | Actions on top. Card per instance with Start/Stop in view and the rest in a menu. VNC button hidden on phones. Charts collapsed. | Start, stop |
| Instance | Tabs scroll. Auto Switcher form in one column. VNC button hidden on phones. | Start, stop, hold scene |
| VNC | Desktop-only notice if opened on a phone. | None |
| Ingest servers | Same as OBS nodes. Live: card per stream. | Check health |
| VMs | Host cards stack. Card per VM: name, status, CPU and RAM bars. Sort and filter in a drawer. | Open VM |
| VM detail | Status, alert switches, stats, then collapsed chart sections. | Toggle alert |
| Backups | Banner, tiles 2 per row, card per VM with status and last backup. | Poll now |
| Security | Already responsive. | Add passkey |
| Auth pages | Add outer padding. | Sign in |

Taps for the common phone tasks:

| Task | Today | After |
|---|---|---|
| Reply to a ticket | 4 taps, then scroll past the transcript | 2 taps (Tickets, ticket), reply box in view |
| Claim a ticket | 4 | 2 (Tickets, Claim on the card) |
| See firing alerts | 2, and only if you think to look | 0 (dashboard) or 1 (bottom bar) |
| Silence an alert | 4 | 3 |
| Ban a user | 5 plus scrolling to the 6th card | 4 (Users, user, Actions, Ban) |
| Grant a plan | 6 to 8 | 4 (Users, row menu, Grant access, confirm) |
| Approve a widget | 3 | 2 from the dashboard (Needs attention row, Approve) |

---

## Step 4: Implementation plan

Each phase is one PR against `staging`. Each can ship alone. Order is by impact.

| # | Phase | Size | What ships |
|---|---|---|---|
| 1 | Shell fixes | S | The frame stops breaking on phones |
| 2 | Navigation | M | New sidebar, tabs, breadcrumbs, bottom bar, counters |
| 3 | Shared building blocks and grid sweep | M | No page scrolls sideways; shared stat grid, page header, table-to-cards, drawer dialog; desktop-only notices |
| 4 | Dashboard | M | New dashboard |
| 5 | Support on a phone | L | Tickets, users, widget review; `/subscriptions` folded in |
| 6 | Alerts on a phone | S | Four alerts tabs |
| 7 | Discord pages | L | Announcements, event log, server settings, ticket settings |
| 8 | Monitoring and infrastructure | L | OBS, ingest, VMs, backups, database, API, EventSub, WebSocket metrics and rooms |
| 9 | Optional: command palette | S | Jump to a page, user or ticket number |

### Phase 1: Shell fixes

Files:
- `app/layout.tsx`: add a `viewport` export (`viewportFit: "cover"`).
- `app/(monitor)/layout.tsx`: `p-4 md:p-6`, `min-w-0`, inner `<main>` becomes a `<div>`, read the `sidebar_state` cookie into `defaultOpen`.
- `components/monitor-sidebar.tsx`: close the mobile drawer when the path changes (`useSidebar().setOpenMobile(false)`).
- `components/monitor-header.tsx`, `components/time-range-selector.tsx`, `components/refresh-interval-selector.tsx`, `components/bandwidth-unit-toggle.tsx`: collapse into one "View" popover below 768px.
- `lib/nav-config.ts`: add a `controls` field per item so the header only shows controls a page uses.
- `app/login/page.tsx`, `app/no-access/page.tsx`: use the existing `components/auth/auth-shell.tsx`.

Risks:
- `SidebarInset` and `Sidebar` live in `packages/ui` and are shared with the main app. Do not edit them; wrap in web-admin.
- Which pages use which control must be right, or a control vanishes from a page that needs it. The audit list is the source: range and refresh on http, ws, obs, ingest, eventsub, supabase, backups, vms; bandwidth on ingest, obs, vms.

### Phase 2: Navigation

Files:
- `lib/nav-config.ts`: new groups, `tabs` per item, `match` patterns, badge keys, breadcrumb trail helper.
- `components/monitor-sidebar.tsx`, `components/monitor-header.tsx`: new groups, counters, linked breadcrumb, phone back arrow.
- New `components/page-tabs.tsx` (route-based, scrollable). Replaces `components/users/user-tabs.tsx`, `components/discord/ticket-settings-nav.tsx` and the inline copies in `discord/tickets/page.tsx` and `users/[id]/activity/page.tsx`.
- New `components/mobile-bottom-nav.tsx`.
- New `lib/nav-counts.ts` plus `app/api/nav-counts/route.ts` (firing alerts, tickets needing reply, pending widgets), polled client-side.
- New layouts for tabs: `app/(monitor)/alerts/layout.tsx`, `app/(monitor)/ws/layout.tsx`, `app/(monitor)/discord/logs/layout.tsx`.
- Route groups, so tabs wrap the right pages without changing URLs: `discord/(server)/` for the overview, welcome, activity, live and permissions pages; `discord/tickets/(index)/` for queue, stats and settings (keeps `tickets/[number]` outside the tab layout).
- `app/(monitor)/supabase/page.tsx`, `app/(monitor)/database/page.tsx`: shared tab row.
- `app/(monitor)/discord/page.tsx`: feature cards become a status list.
- `lib/discord/setup-status.ts`: "Not set up" badges map to the Server settings item and its tabs, and to Tickets and Event log.
- `docs/web-admin.md`: refresh the stale pages table.

Risks:
- Moving folders into route groups moves their `loading.tsx` files and any relative imports. URLs must stay identical. Check each moved route by hand.
- The Discord bot links to `/discord/tickets/{number}` (`apps/discord-bot/src/lib/tickets/events.ts:49`). That URL must not change.
- `/discord` is currently an exact match. The new Server settings item must match its four tabs but not `/discord/tickets`, `/discord/logs`, `/discord/messages` or `/discord/announcements`.
- Counters add queries. Keep them out of the server layout; one cached API route, polled every 30 to 60 seconds.
- A fixed bottom bar can cover page content and other fixed bars. Reserve space in the frame.

### Phase 3: Shared building blocks and grid sweep

Files:
- New in `components/widgets/`: `stat-grid.tsx`, `responsive-dialog.tsx` (dialog on desktop, drawer on phone), `data-list.tsx` (table on desktop, cards on phone, column priority), `filter-drawer.tsx`, `save-bar.tsx` (moved from `components/discord/setting-row.tsx`, fixed variant).
- `components/widgets/page-header.tsx`: back link, overflow menu for secondary actions on phones.
- `components/widgets/stat-card.tsx`: hint becomes visible text or a popover.
- `components/widgets/page-skeleton.tsx`: drop the inline grid.
- New `components/widgets/desktop-only.tsx`: shows the notice below 768px (CSS, not JS) and the tool above it. Applied in `ws/live/page.tsx`, `ws/topology/page.tsx`, `ws/topology/[roomId]/page.tsx`, `app/vnc/page.tsx`, `components/discord/built-message-editor.tsx`, and around the builder card in `ticket-panel-editor.tsx` and `ticket-opening-editor.tsx`. VNC buttons in `components/admin/node-detail-client.tsx` and `instance-detail-client.tsx` hide on phones.
- Grid sweep (class changes only): `overview/page.tsx`, `http/page.tsx`, `ws/page.tsx`, `database/page.tsx`, `obs/page.tsx`, `alerts/page.tsx`, `components/ws-room-table.tsx`.
- `PageHeader` and sentence-case titles on the pages that hand-roll them: overview, http, ws and its sub-pages, database, obs and its detail pages, subscriptions, widget-library.

Risks:
- Wide reach, small changes. Desktop layout could shift. Compare each swept page at 1280px before and after.
- `data-list.tsx` is new shared code. Prove it on one page (alerts) in this phase; migrate the other tables in their own phases.
- The desktop-only notice must hide the tool with CSS only. The live feed and topology open a WebSocket on mount, so on a phone they still connect in the background unless the component is also skipped. Skip mounting below 768px.
- The message builder itself (`packages/ui/src/components/message-builder/*`) is not touched.

### Phase 4: Dashboard

Files:
- `app/(monitor)/overview/page.tsx`, `overview/loading.tsx`.
- New `components/overview/`: `attention-list.tsx`, `status-strip.tsx`, `key-numbers.tsx`, `live-now.tsx`, `shortcuts.tsx`.
- New `lib/overview.ts`: builds the attention list and subsystem status.

Reuse:
- `getAlertStates` (`packages/supabase/src/queries/alerts.ts:11`) and `getRuleCatalog` with `RULE_GROUPS` (`packages/alerting/src/rules.ts:43`) for sections 1 and 2.
- Ticket view counts from `discord/tickets/page.tsx`, pending entries from `actions/widget-library.ts`, `getDiscordSetupGaps`, `getOverviewStats` (failed syncs).
- Live streamers and viewers: the existing Live now query in `overview/page.tsx:124-172`.
- Running OBS instances and GPU usage: the fleet stat queries already used by `obs/page.tsx:136-157`.
- Counters from `lib/nav-counts.ts` (phase 2).

Risks:
- More data sources on one page. Fetch in parallel with `Promise.allSettled` so one failing source hides only its own section.
- A subsystem with no alert rules would always look green. Show "No checks" for those, never green.
- The request total is computed two ways today. It leaves the dashboard; fix the `/http` version in phase 8.

### Phase 5: Support on a phone

Files:
- Tickets: `discord/tickets/page.tsx`, `components/discord/ticket-filters-form.tsx`, `components/discord/ticket-list-live.tsx`, new shared `components/discord/ticket-list.tsx` (also used by `users/[id]/tickets/page.tsx`).
- Ticket: `components/discord/ticket-page/ticket-page.tsx`, `ticket-conversation.tsx`, `ticket-details.tsx`, `ticket-timeline.tsx`, `components/discord/ticket-reply.tsx`, `ticket-transcript.tsx`, `ticket-manage.tsx`, `ticket-actions.tsx`.
- Users: `users/page.tsx`, `users/[id]/layout.tsx`, `users/[id]/page.tsx`, `components/users/moderation.tsx`, `components/users/user-actions.tsx`, `components/users/user-subscriptions.tsx`, the other four user tab pages.
- Subscriptions merge: delete `subscriptions/page.tsx` and `components/subscriptions/subscriptions-client.tsx`; keep `components/subscriptions/subscription-dialogs.tsx`; redirect in `next.config`.
- Widget review: `components/widget-library/admin-widget-library-client.tsx`.

Risks:
- The ticket page is realtime. A fixed reply box plus the phone keyboard needs `dvh` units and testing on a real iOS and Android device.
- Claim from the list calls the bot. It needs the admin's Discord link, same as the ticket page; show the same notice when it is missing.
- Removing `/subscriptions` loses the all-users-with-plans view. The `Has a plan` filter on `/users` replaces it; confirm it shows the same people before deleting.

### Phase 6: Alerts on a phone

Files: `alerts/page.tsx`, `alerts/history/page.tsx`, `components/alerts/silence-menu.tsx`, `components/alerts/rules-editor.tsx`, `components/alerts/notifications-editor.tsx`.

Risks:
- Rule editing moves from inline cells to a drawer. Dirty-state and save logic must carry over unchanged.
- Add a confirm to Reset.

### Phase 7: Discord pages

Files:
- Announcements: `components/discord/announcement-list.tsx`, `announcement-editor.tsx`, `announcement-preview.tsx`.
- Event log: `discord/logs/page.tsx`, `components/discord/log-settings-form.tsx`.
- Server settings: `components/discord/welcome-form.tsx`, `activity-form.tsx`, `live-form.tsx`, `command-permission-row.tsx`, `discord/live/page.tsx`, `discord/permissions/page.tsx`.
- Ticket settings: `components/discord/tickets-form.tsx`, `ticket-messages-form.tsx`, `ticket-automation-form.tsx`, `ticket-options-manager.tsx`, `ticket-tags-manager.tsx`, `ticket-form-editor.tsx`, `ticket-category-rules-form.tsx`, `discord/tickets/settings/categories/[id]/page.tsx`.
- `packages/ui/src/components/sortable-list.tsx`: Move up and Move down.

Risks:
- Moving a setting's text next to its toggle changes which form saves it. Keep the same server actions; only regroup the fields.
- `sortable-list.tsx` is shared with other apps. The new buttons must be opt-in.

### Phase 8: Monitoring and infrastructure

Files:
- OBS: `obs/page.tsx`, `components/admin/nodes-section.tsx`, `node-fleet-table.tsx`, `obs-node-table.tsx`, `obs-instance-table.tsx`, `components/admin/node-detail-client.tsx`, `instance-detail-client.tsx`, both detail pages.
- Ingest: `ingest/page.tsx`, `components/admin/ingest-nodes-section.tsx`, `ingest-node-table.tsx`, `ingest-live-panel.tsx`, `active-signals-table.tsx`.
- VMs: `vms/page.tsx`, `components/vms/vm-table.tsx`, `other-vms.tsx`, `vm-alerts-card.tsx`, both detail pages.
- Backups: `components/backups/backup-dashboard.tsx`, `backup-vm-detail.tsx`.
- Database: `supabase/page.tsx`, `components/charts/supabase-health.tsx`, `database/page.tsx`.
- API, EventSub, WebSocket: `http/page.tsx`, `components/charts/eventsub-dashboard.tsx`, `eventsub-shard-grid.tsx`, `ws/page.tsx`, `components/ws-room-table.tsx`.

Risks:
- Merging the three node tables joins three data sources (registry, health probe, Influx). A missing source must leave the row visible with blanks.
- Fleet and Manage tabs need a home. Use `?tab=` so no new routes appear.
- Largest phase. It can split into 8a (OBS and ingest), 8b (VMs and backups), 8c (the rest).

### Phase 9 (optional): Command palette

Files: new `components/command-palette.tsx` using the `command` primitive already in `packages/ui`, mounted in `app/(monitor)/layout.tsx`; a search action for users and ticket numbers.

Risk: low. Skip it if the new navigation is enough.

### Verification (every phase)

- `bun run check-types`, `bun run lint`, `bun test` in `apps/web-admin`.
- Run locally (`bun run dev`, port 3003) and check each touched page at 375px, 768px and 1280px: no sideways page scroll, no clipped controls, targets at least 44px.
- Check each touched page on one real phone, both themes.
- Phase 2: open every old URL and confirm it still resolves, including a bot-generated ticket link.
- Phase 5: reply, claim and close a ticket on local Discord; ban and lift a ban on a test user.
- Desktop check at 1280px against staging to catch layout drift.

---

## Decisions

Answered on 2026-10-04:

| Question | Answer | Effect on the plan |
|---|---|---|
| Most common tasks, especially on a phone | Tickets, alerts and health, users and plans | Bottom bar: Home, Tickets, Alerts, Users, More. Shortcuts: Answer tickets, Check alerts, Find a user, Grant access. |
| Key numbers on the dashboard | Live streamers, Cloud OBS load | Tiles: live streamers, total viewers, running OBS instances, GPU node usage. |
| Merges | Yes to all four | Subscriptions into Users; Discord settings into Server settings; Alerts and WebSocket as tabs; Database and Supabase as one item. |
| Desktop-heavy tools on a phone | Desktop only | Message builder, topology, live feed and VNC show a notice on phones. The "hard cases" phase is gone. |

Still an assumption, not asked:

- **Phone navigation is a bottom bar** with 4 slots plus More. The alternative is the drawer only: less work (no `mobile-bottom-nav.tsx`), one more tap for every task. Say so before phase 2 if you prefer the drawer.
