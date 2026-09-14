# discord-bot

A Discord bot for the StreamWizard server, built on Bun + discord.js v14.

## Internal structure

- `src/commands/` — one file per slash command. Each exports a default object satisfying `Command` (`data` + `execute`). Subfolders are supported — `commandHandler.ts` scans recursively, so group commands by category as the bot grows (e.g. `commands/moderation/ban.ts`).
- `src/events/` — one file per Discord gateway event. Each exports a default object satisfying `BotEvent` (`name` + `execute`, optional `once`). `eventHandler.ts` wires them all up automatically — no manual registration in `index.ts`.
- `src/handlers/` — the loaders that scan `commands/` and `events/` and attach everything to the client.
- `src/lib/discord-client.ts` — the `Client` singleton and its gateway intents. Start minimal; add intents only when a feature needs them (each one may require re-approval for verified bots).
- `src/lib/env.ts` — zod-validated environment variables.
- `src/lib/permissions.ts` — per-command role allowlists, checked in `events/interactionCreate.ts` before any command runs.
- `src/http/server.ts` — internal Hono API that web-admin's Discord dashboard calls after a save (see below).
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

web-admin's `/discord` pages write settings straight to Supabase, then call the bot so changes land without a restart. The bot starts a small Hono server (`src/http/server.ts`) when `DISCORD_BOT_INTERNAL_SECRET` is set; without it the server stays off and saves still apply once the in-memory caches expire (permissions 5 min, activity 60 s).

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
| `POST /verified-role` `{ oldRoleId, newRoleId }` | Moves members from the old verified role to the new one, in the background. |
| `POST /ticket-panel` | Posts the ticket panel in the stored panel channel and removes the previous one. |
| `POST /test-welcome` `{ discordUserId }` | Posts a mock welcome for that member without touching `join_number`. |

## Running locally

From the repo root:

```bash
bun dev --filter=@repo/discord-bot
```

## Deploying slash commands

Run whenever a command is added, changed, or removed:

```bash
cd apps/discord-bot
bun run deploy-commands
```

Set `DISCORD_GUILD_ID` in dev for instant propagation to a single test server. Omit it in staging/production to register commands globally (can take up to an hour to propagate).
