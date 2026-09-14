"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { addCommandRole, getCommandRoles, removeCommandRole } from "@repo/supabase/queries/discord";
import { assertRole } from "@/lib/discord/api";
import { DashboardError, requireDiscordAdmin, toActionError, type DiscordActionResult } from "@/lib/discord/action";
import { recordChange } from "@/lib/discord/audit";
import { callBot, staleWarning } from "@/lib/discord/bot-bridge";
import { snowflakeSchema } from "@/schemas/discord";

const commandRolesSchema = z.object({
  // Discord's own rule for slash command names.
  commandName: z.string().regex(/^[-_\p{L}\p{N}]{1,32}$/u, "Invalid command name"),
  roleIds: z.array(snowflakeSchema).max(100),
});

export type CommandRolesInput = z.infer<typeof commandRolesSchema>;

export async function saveCommandRoles(input: CommandRolesInput): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const parsed = commandRolesSchema.safeParse(input);
    if (!parsed.success) throw new DashboardError(parsed.error.issues[0]?.message ?? "Invalid input");
    const { commandName } = parsed.data;

    const current = (await getCommandRoles(supabaseAdmin, guildId, commandName)).map((row) => row.role_id);
    const wanted = [...new Set(parsed.data.roleIds)];
    const toAdd = wanted.filter((id) => !current.includes(id));
    const toRemove = current.filter((id) => !wanted.includes(id));
    // New roles only, so a role deleted in Discord can still be removed.
    for (const id of toAdd) await assertRole(id);

    await Promise.all([
      ...toAdd.map((id) => addCommandRole(supabaseAdmin, guildId, commandName, id)),
      ...toRemove.map((id) => removeCommandRole(supabaseAdmin, guildId, commandName, id)),
    ]);

    const bot = await callBot(guildId, "/cache/permissions", { commandName });

    const key = `/${commandName}`;
    await recordChange({
      userId,
      guildId,
      section: "permissions",
      before: { [key]: [...current].sort() },
      after: { [key]: [...wanted].sort() },
    });
    revalidatePath("/discord", "layout");
    return { error: null, warning: staleWarning(bot) };
  } catch (error) {
    return toActionError(error, "save command roles", "Couldn't save command permissions. Try again?");
  }
}
