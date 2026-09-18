import type { DiscordApplicationCommand } from "@repo/discord-api";
import { reportError } from "@repo/sentry";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getGuildCommandPermissions } from "@repo/supabase/queries/discord";
import { Card, CardContent, Table, TableBody, TableHead, TableHeader, TableRow } from "@repo/ui";
import { CommandPermissionRow, type CommandView } from "@/components/discord/command-permission-row";
import { PageHeader } from "@/components/widgets/page-header";
import { getGuildRoles, requireDiscordContext } from "@/lib/discord/api";
import { toRoleOptions } from "@/lib/discord/options";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function DiscordPermissionsPage() {
  const { api, guildId } = requireDiscordContext();

  let deployed: DiscordApplicationCommand[] | null = null;
  if (env.DISCORD_CLIENT_ID) {
    try {
      deployed = await api.guilds.listApplicationCommands(env.DISCORD_CLIENT_ID);
    } catch (error) {
      reportError(error, "web-admin discord: list commands");
    }
  }

  const [permissions, roles] = await Promise.all([getGuildCommandPermissions(supabaseAdmin, guildId), getGuildRoles()]);

  const rolesByCommand = new Map<string, string[]>();
  for (const row of permissions) {
    rolesByCommand.set(row.command_name, [...(rolesByCommand.get(row.command_name) ?? []), row.role_id]);
  }

  const commands: CommandView[] = (deployed ?? []).map((command) => ({
    name: command.name,
    description: command.description || null,
    deployed: true,
    roleIds: rolesByCommand.get(command.name) ?? [],
  }));
  // Keep stored rules for commands Discord doesn't list (renamed, removed, or
  // the list failed to load) so they can still be cleaned up.
  for (const [name, roleIds] of rolesByCommand) {
    if (!commands.some((c) => c.name === name)) {
      commands.push({ name, description: null, deployed: deployed === null, roleIds });
    }
  }
  commands.sort((a, b) => a.name.localeCompare(b.name));

  const roleOptions = toRoleOptions(roles);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command permissions"
        description="Limit who can run each slash command or right-click entry. Empty means everyone. The server owner can always run everything."
      />
      {deployed === null && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {env.DISCORD_CLIENT_ID
            ? "Couldn't load the command list from Discord, so only commands with rules show up."
            : "Set DISCORD_CLIENT_ID to list every command. Until then only commands with rules show up."}
        </p>
      )}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Command</TableHead>
                <TableHead>Allowed roles</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {commands.map((command) => (
                <CommandPermissionRow key={`${command.name}:${command.roleIds.join(",")}`} command={command} roles={roleOptions} />
              ))}
              {commands.length === 0 && (
                <TableRow>
                  <td colSpan={3} className="p-6 text-center text-sm text-muted-foreground">
                    No commands to show.
                  </td>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
