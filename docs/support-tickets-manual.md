# StreamWizard Support Tickets: Getting Started

For the support team. How tickets work in the StreamWizard Discord server and the admin dashboard, and what to do with them.

Last updated: 18 September 2026. Describes the ticket system as of the current release branch; if a button or page is missing, it has not been deployed yet.

---

## 1. What a ticket is

A member opens a ticket from the panel in the Discord server. The bot creates a private channel that only the member, the staff roles and the bot can see. Everything in that channel is saved as it happens, so nothing is lost if a message is edited or deleted, or if the channel disappears.

A ticket has:

- A number, like #0042
- A category (Bug, Feature request, Billing, ...) and optionally a product (Cloud OBS, Overlays, ...)
- A subject and the answers to the category's form
- A status: open or closed
- Optionally a priority (low, medium, high), a claimer, and added members

You can work a ticket from Discord or from the dashboard. Both do the same things.

## 2. Where things are

**Discord**
- The ticket panel: the message with the "Create ticket" button (or buttons, or a dropdown) in the support channel.
- Ticket channels: under the Tickets category. Name looks like `ticket-0042`.
- Each ticket channel starts with the ticket card: subject, category, product, the member's answers, and the Claim and Close buttons.

**Dashboard** (web-admin, log in with Twitch, your Discord must be linked and have the staff role)
- Discord > Tickets: list of all tickets, filter by status, category, product, priority, close reason.
- Discord > Tickets > #0042: the full conversation, timeline, and the staff actions.
- Discord > Tickets > Settings: categories, products, form questions, panel design, messages. Admins only.

## 3. The daily routine

1. **Look at open tickets.** Dashboard list filtered on "open", or the Tickets category in Discord. Unclaimed and high priority first.
2. **Claim it.** Claim button on the ticket card, `/ticket claim`, or the Claim button on the dashboard. Claiming tells the member and other staff that you own it. If "hide claimed tickets from other staff" is on, only you and the member see the channel after that.
3. **Talk to the member.** Reply in the channel. From the dashboard you can also type a reply; it is posted by the bot with your name on it.
4. **Set a priority if it matters.** `/ticket priority` or the dropdown on the dashboard.
5. **Close it when done.** Close button, `/ticket close`, or the dashboard. Always add a reason when it is not obvious ("Fixed in 1.4.2", "Member didn't respond"). The reason goes to the member and stays on the ticket.

When you close, the channel is deleted. The conversation stays in the dashboard, and the member gets a DM with the conversation as a text file.

## 4. The staff commands

All in the ticket channel unless noted. Staff only, except `new`, `list` and `transcript`.

| Command | What it does |
|---|---|
| `/ticket new` | Open a ticket (for anyone, anywhere) |
| `/ticket list` | Your own tickets |
| `/ticket claim` | Take this ticket |
| `/ticket release` | Give it back so someone else can claim it |
| `/ticket close [reason]` | Close, with an optional reason |
| `/ticket add @member` | Let someone else into the ticket (a second person from the member's team, a specialist) |
| `/ticket remove @member` | Take them out again |
| `/ticket transfer @member` | Make someone else the ticket's owner |
| `/ticket move <category>` | File it under another category; staff roles of that category get access |
| `/ticket priority <level>` | low, medium, high, or none |
| `/ticket subject <text>` | Reword the subject |
| `/ticket transcript` | The conversation so far, as a file only you see |

`/ticket-admin` (setup, settings) is for admins with Manage Server.

Every one of these is also on the dashboard ticket page under "Manage".

## 5. Things to know

- **Only staff can close.** Members ask; you close.
- **Members are limited.** The server can limit open tickets per member, per category, and add a wait time between tickets. If a member says "it won't let me open a ticket", that is usually why. The bot tells them the reason.
- **Deleted messages are kept.** They show in the dashboard with a "Deleted" mark. Members are told this in the privacy policy.
- **Do not delete ticket channels by hand.** Close them instead. A channel deleted by hand still gets closed by the bot, but with the reason "channel deleted", which looks like an accident in the history.
- **Do not rename ticket channels.** Discord only allows two renames per ten minutes; the bot handles naming.
- **Bot replies do not count as a response.** Response-time stats look at the first message from a staff member. Reply as yourself, or through the dashboard.
- **Images.** Screenshots up to 500 KB are copied and stay visible in the dashboard after the channel is gone. Bigger files and non-images keep only their name and size. Ask members for screenshots, not videos, when possible.

## 6. Escalating

- Bug you can reproduce: note the steps in the ticket, set priority high if it blocks streaming, and tag the dev in the internal channel with the ticket number.
- Billing or account issue: use the member's StreamWizard account link on the dashboard ticket page (top right) to check their account.
- Not sure what it is: leave it unclaimed with a note in the channel, or move it to the right category.

## 7. Settings (admins)

Discord > Tickets > Settings has:

- **General**: staff role, Discord category, panel channel, limits, blocked roles, close-on-leave, DM on close.
- **Panel**: the message members open tickets from. Designed in the message builder.
- **Categories**: each category's name, emoji, staff roles, ping roles, limits, cooldown, form questions and opening message.
- **Products**: the product dropdown.
- **Messages**: the text of the closing DM. Placeholders like `[ticket.number]` are filled in.

Changes take effect within a minute; the panel is re-posted when its design or channel changes.

---

Questions about the system itself: ask Jochem.
