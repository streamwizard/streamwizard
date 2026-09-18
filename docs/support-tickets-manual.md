# StreamWizard Support Tickets: Getting Started

For the support team. How tickets work in the StreamWizard Discord server and the admin dashboard, and what to do with them.

Last updated: 18 September 2026. Describes the ticket system as of the current release branch; if a button or page is missing, it has not been deployed yet.

---

## 1. What a ticket is

A member opens a ticket from the panel in the Discord server, by DMing the bot (when that is switched on), or by right-clicking a message. The bot creates a private channel that only the member, the staff roles and the bot can see. Everything in that channel is saved as it happens, so nothing is lost if a message is edited or deleted, or if the channel disappears.

A ticket has:

- A number, like #0042
- A category (Bug, Feature request, Billing, ...) and optionally a product (Cloud OBS, Overlays, ...)
- A subject and the answers to the category's form
- A status: open or closed
- Optionally a priority (low, medium, high), a claimer, added members, a pending close request, and a rating from the member once it is closed

You can work a ticket from Discord or from the dashboard. Both do the same things.

## 2. Where things are

**Discord**
- The ticket panel: the message with the "Create ticket" button (or buttons, or a dropdown) in the support channel.
- Ticket channels: under the Tickets category. Name looks like `ticket-0042`.
- Each ticket channel starts with the ticket card: subject, category, product, the member's answers, and the Claim and Close buttons. In "members ask, staff decide" mode there is a Request close button too.
- Right-click menus: on a message, "Create ticket from message" and "Pin in ticket"; on a member, "Create ticket for user". Under Apps in Discord's right-click menu.

**Dashboard** (web-admin, log in with Twitch, your Discord must be linked and have the staff role)
- Discord > Tickets: list of all tickets, filter by status (including "Open, gone quiet"), category, product, priority, close reason.
- Discord > Tickets > #0042: the full conversation, timeline, the staff actions, a pending close request if there is one, and the member's rating once they gave one.
- Discord > Tickets > Stats: opened and closed per day, first-reply and time-to-close averages, ratings, per category. 7, 30 or 90 days.
- Discord > Tickets > Settings: categories, products, form questions, panel design, messages, automation, tags. Admins only.

## 3. The daily routine

1. **Look at open tickets.** Dashboard list filtered on "open", or the Tickets category in Discord. Unclaimed and high priority first. "Open, gone quiet" shows the ones the bot has already nudged.
2. **Claim it.** Claim button on the ticket card, `/ticket claim`, or the Claim button on the dashboard. Claiming tells the member and other staff that you own it. If "hide claimed tickets from other staff" is on, only you and the member see the channel after that.
3. **Talk to the member.** Reply in the channel. From the dashboard you can also type a reply; it is posted by the bot with your name on it. For the answers you keep typing, use a tag: `/tag <name>` in Discord, or "Insert a tag" next to the dashboard reply box.
4. **Set a priority if it matters.** `/ticket priority` or the dropdown on the dashboard.
5. **Answer close requests.** When the member hits Request close, the bot posts a message with Accept and Keep-open buttons and pings staff. Accept closes the ticket; Keep it open clears the request. The same two buttons are on the dashboard ticket page. A request nobody answers lapses after a day (configurable) and the ticket stays open.
6. **Close it when done.** Close button, `/ticket close`, or the dashboard. Always add a reason when it is not obvious ("Fixed in 1.4.2", "Member didn't respond"). The reason goes to the member and stays on the ticket.

When you close, the channel is deleted. The conversation stays in the dashboard, and the member gets a DM with the conversation as a text file and, for most categories, five star buttons to rate the ticket. Ratings and comments show on the ticket page and on the Stats page.

## 4. The staff commands

All in the ticket channel unless noted. Staff only, except `new`, `list` and `transcript`.

| Command | What it does |
|---|---|
| `/ticket new` | Open a ticket (for anyone, anywhere) |
| `/ticket list` | Your own tickets |
| `/ticket claim` | Take this ticket |
| `/ticket release` | Give it back so someone else can claim it |
| `/ticket close [reason]` | Close, with an optional reason. For a member this becomes a close request when the server uses those. |
| `/ticket add @member` | Let someone else into the ticket (a second person from the member's team, a specialist) |
| `/ticket remove @member` | Take them out again |
| `/ticket transfer @member` | Make someone else the ticket's owner |
| `/ticket move <category>` | File it under another category; staff roles of that category get access |
| `/ticket priority <level>` | low, medium, high, or none |
| `/ticket subject <text>` | Reword the subject |
| `/ticket transcript` | The conversation so far, as a file only you see |
| `/tag <name> [for]` | Post a canned answer. Works in any channel. "for" mentions a member and fills in their name. |

Right-click menus (under Apps):

| Entry | On | What it does |
|---|---|---|
| Create ticket from message | a message | Opens the ticket form with the message quoted as the description; the ticket keeps a link to it. Anyone can use it. |
| Create ticket for user | a member | Staff open a ticket that belongs to that member. The ticket card says who opened it for them. |
| Pin in ticket | a message in a ticket | Pins it (or unpins it). Pinned messages are marked in the transcript. |

`/ticket-admin` (setup, settings) is for admins with Manage Server.

Every one of these is also on the dashboard ticket page under "Manage".

## 5. Things to know

- **Who closes depends on the setting.** By default only staff close and members ask in the channel. The server can switch to "members ask, staff decide" (Request close button, you accept or keep open) or let the opener close their own ticket. Admins set this under Settings > Automation.
- **Quiet tickets get a nudge.** When switched on, the bot posts a reminder in a ticket nobody has written in for a while, mentioning the member. Any reply clears it. If auto-close is on too, the reminder says so and the ticket closes on its own if nobody answers in time; the member still gets the closing DM. Off by default. The dashboard shows "Quiet since" on those tickets.
- **Members are limited.** The server can limit open tickets per member, per category, and add a wait time between tickets. If a member says "it won't let me open a ticket", that is usually why. The bot tells them the reason.
- **Outside working hours** (when set) a new ticket gets a line saying when the team is next around, with a live countdown. Nothing else changes: the ticket is open and you can answer whenever.
- **Tags answer on their own.** A tag with auto-reply on posts itself once per ticket when a member's message contains one of its keywords. Read the tag before you repeat it. Tags are edited under Settings > Tags.
- **Ratings are the member's word.** Once the ticket is closed the member can rate it 1 to 5 and add a comment. Don't chase a rating; the DM asks once.
- **DMs to the bot.** When "Open tickets by DM" is on, a member who DMs the bot only gets a Create ticket button. The bot doesn't read or keep the DM text, so nothing they wrote there reaches you; ask them in the ticket.
- **Deleted messages are kept.** They show in the dashboard with a "Deleted" mark. Members are told this in the privacy policy.
- **Do not delete ticket channels by hand.** Close them instead. A channel deleted by hand still gets closed by the bot, but with the reason "channel deleted", which looks like an accident in the history.
- **Do not rename ticket channels.** Discord only allows two renames per ten minutes; the bot handles naming.
- **Bot replies do not count as a response.** Response-time stats look at the first message from a staff member. Reply as yourself, or through the dashboard. Tags posted with `/tag` count as you; auto-replies don't.
- **Images.** Screenshots up to 500 KB are copied and stay visible in the dashboard after the channel is gone. Bigger files and non-images keep only their name and size. Ask members for screenshots, not videos, when possible.

## 6. Escalating

- Bug you can reproduce: note the steps in the ticket, set priority high if it blocks streaming, and tag the dev in the internal channel with the ticket number.
- Billing or account issue: use the member's StreamWizard account link on the dashboard ticket page (top right) to check their account.
- Not sure what it is: leave it unclaimed with a note in the channel, or move it to the right category.
- Someone reports a message elsewhere in the server: right-click it, "Create ticket from message", and the ticket carries the link.

## 7. Settings (admins)

Discord > Tickets > Settings has:

- **General**: staff role, Discord category, panel channel, limits, blocked roles, close-on-leave, DM on close, open tickets by DM.
- **Panel**: the message members open tickets from. Designed in the message builder.
- **Categories**: each category's name, emoji, staff roles, ping roles, limits, cooldown, whether to ask for a rating, form questions and opening message.
- **Products**: the product dropdown.
- **Messages**: the closing DM, the rating prompt, the quiet-ticket reminders, the automatic-close reason, the close-request line and the outside-working-hours notice. Placeholders like `[ticket.number]` or `[stats.avg_response]` are filled in.
- **Automation**: the quiet-ticket reminder and auto-close timers, who may close a ticket and how long a close request waits, and the working hours (time zone plus ranges per weekday).
- **Tags**: canned answers, their keywords and whether they auto-reply. Drag to reorder.

Changes take effect within a minute; the panel is re-posted when its design or channel changes.

---

Questions about the system itself: ask Jochem.
