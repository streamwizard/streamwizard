"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  createVoiceHub,
  deleteVoiceHub,
  findUnknownVoicePlaceholders,
  getVoiceSettings,
  listVoiceHubs,
  unblockVoiceRename,
  updateVoiceHub,
  upsertVoiceSettings,
  VOICE_HUBS_MAX,
  VOICE_NAME_TEMPLATE_MAX,
  VOICE_STAFF_ROLES_MAX,
  VOICE_USER_LIMIT_MAX,
  type VoiceHub,
  type VoiceHubInput,
} from "@repo/supabase/queries/discord-voice";
import { assertChannel, assertRole } from "@/lib/discord/api";
import { DashboardError, requireDiscordAdmin, toActionError, type DiscordActionResult } from "@/lib/discord/action";
import { recordChange } from "@/lib/discord/audit";
import { callBot, staleWarning } from "@/lib/discord/bot-bridge";
import { nullableSnowflakeSchema, snowflakeSchema } from "@/schemas/discord";

// Join-to-create hubs (SW-335): a lobby voice channel, where its channels go,
// what they're called and how many fit. The bot caches hubs for a minute;
// every save asks it to drop that copy.

const idSchema = z.string().uuid();

const staffRolesSchema = z
  .array(snowflakeSchema)
  .max(VOICE_STAFF_ROLES_MAX, `That's more than ${VOICE_STAFF_ROLES_MAX} staff roles.`)
  .transform((ids) => [...new Set(ids)]);

const hubSchema = z.object({
  lobbyChannelId: snowflakeSchema,
  categoryId: nullableSnowflakeSchema,
  nameTemplate: z
    .string()
    .trim()
    .min(1, "Give the channels a name.")
    .max(VOICE_NAME_TEMPLATE_MAX, `Names stop at ${VOICE_NAME_TEMPLATE_MAX} characters.`),
  defaultUserLimit: z
    .number()
    .int()
    .min(0)
    .max(VOICE_USER_LIMIT_MAX, `Discord stops at ${VOICE_USER_LIMIT_MAX} people.`),
  /** Null: the hub uses the server's voice staff roles. */
  staffRoleIds: staffRolesSchema.nullable(),
  rememberOwnerSettings: z.boolean(),
});
export type VoiceHubFormInput = z.infer<typeof hubSchema>;

const GONE = "That lobby doesn't exist anymore. Refresh the page?";

function parseId(id: string): string {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) throw new DashboardError(GONE);
  return parsed.data;
}

function parse(input: unknown): VoiceHubFormInput {
  const parsed = hubSchema.safeParse(input);
  if (!parsed.success) throw new DashboardError(parsed.error.issues[0]?.message ?? "Invalid input");
  const unknown = findUnknownVoicePlaceholders(parsed.data.nameTemplate);
  if (unknown.length > 0) throw new DashboardError(`Unknown placeholder ${unknown.map((u) => `{${u}}`).join(", ")}.`);
  return parsed.data;
}

const toRow = (input: VoiceHubFormInput): VoiceHubInput => ({
  lobby_channel_id: input.lobbyChannelId,
  category_id: input.categoryId,
  name_template: input.nameTemplate,
  default_user_limit: input.defaultUserLimit,
  staff_role_ids: input.staffRoleIds,
  remember_owner_settings: input.rememberOwnerSettings,
});

const auditValues = (hub: VoiceHubInput) => ({
  lobby_channel_id: hub.lobby_channel_id,
  category_id: hub.category_id,
  name_template: hub.name_template,
  default_user_limit: hub.default_user_limit,
  staff_role_ids: hub.staff_role_ids ? [...hub.staff_role_ids].sort() : null,
  remember_owner_settings: hub.remember_owner_settings,
});

/** New role ids only: a stored role deleted in Discord can still be removed, or kept, without failing the save. */
async function assertNewRoles(next: readonly string[] | null, current: readonly string[] | null | undefined): Promise<void> {
  for (const id of next ?? []) if (!current?.includes(id)) await assertRole(id);
}

/** Checks only the ids that changed, so a category deleted in Discord doesn't block fixing the name. */
async function assertChannels(next: VoiceHubFormInput, current: VoiceHub | null, others: VoiceHub[]): Promise<void> {
  if (others.some((hub) => hub.lobby_channel_id === next.lobbyChannelId)) {
    throw new DashboardError("That channel is already a lobby.");
  }
  if (next.lobbyChannelId !== current?.lobby_channel_id) await assertChannel(next.lobbyChannelId, ["voice"]);
  if (next.categoryId && next.categoryId !== current?.category_id) await assertChannel(next.categoryId, ["category"]);
  await assertNewRoles(next.staffRoleIds, current?.staff_role_ids);
}

async function finish(guildId: string): Promise<DiscordActionResult> {
  revalidatePath("/discord", "layout");
  return { error: null, warning: staleWarning(await callBot(guildId, "/cache/voice-hubs")) };
}

export async function createVoiceHubAction(input: VoiceHubFormInput): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const next = parse(input);
    const existing = await listVoiceHubs(supabaseAdmin, guildId);
    if (existing.length >= VOICE_HUBS_MAX) throw new DashboardError(`That's ${VOICE_HUBS_MAX} lobbies already. Remove one first.`);
    await assertChannels(next, null, existing);

    const created = await createVoiceHub(supabaseAdmin, guildId, toRow(next));
    await recordChange({ userId, guildId, section: "voice", action: "create", after: auditValues(created) });
    return finish(guildId);
  } catch (error) {
    return toActionError(error, "create voice hub", "Couldn't add the lobby. Try again?");
  }
}

export async function updateVoiceHubAction(id: string, input: VoiceHubFormInput): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const hubId = parseId(id);
    const next = parse(input);
    const existing = await listVoiceHubs(supabaseAdmin, guildId);
    const current = existing.find((hub) => hub.id === hubId);
    if (!current) throw new DashboardError(GONE);
    await assertChannels(next, current, existing.filter((hub) => hub.id !== hubId));

    if (!(await updateVoiceHub(supabaseAdmin, guildId, hubId, toRow(next)))) throw new DashboardError(GONE);
    await recordChange({ userId, guildId, section: "voice", before: auditValues(current), after: auditValues(toRow(next)) });
    return finish(guildId);
  } catch (error) {
    return toActionError(error, "update voice hub", "Couldn't save the lobby. Try again?");
  }
}

export async function removeVoiceHubAction(id: string): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const hubId = parseId(id);
    const current = (await listVoiceHubs(supabaseAdmin, guildId)).find((hub) => hub.id === hubId);
    if (!current) throw new DashboardError(GONE);
    if (!(await deleteVoiceHub(supabaseAdmin, guildId, hubId))) throw new DashboardError(GONE);
    await recordChange({
      userId,
      guildId,
      section: "voice",
      action: "delete",
      before: { lobby_channel_id: current.lobby_channel_id },
      after: { lobby_channel_id: null },
    });
    return finish(guildId);
  } catch (error) {
    return toActionError(error, "remove voice hub", "Couldn't remove the lobby. Try again?");
  }
}

const settingsSchema = z.object({ staffRoleIds: staffRolesSchema });
export type VoiceSettingsInput = z.input<typeof settingsSchema>;

/** The server's voice staff roles: lobbies without their own list use these. */
export async function saveVoiceSettingsAction(input: VoiceSettingsInput): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const parsed = settingsSchema.safeParse(input);
    if (!parsed.success) throw new DashboardError(parsed.error.issues[0]?.message ?? "Invalid settings");
    const next = parsed.data.staffRoleIds;

    const current = (await getVoiceSettings(supabaseAdmin, guildId))?.staff_role_ids ?? [];
    await assertNewRoles(next, current);
    await upsertVoiceSettings(supabaseAdmin, guildId, { staff_role_ids: next });
    await recordChange({
      userId,
      guildId,
      section: "voice",
      before: { staff_role_ids: [...current].sort() },
      after: { staff_role_ids: [...next].sort() },
    });
    return finish(guildId);
  } catch (error) {
    return toActionError(error, "save voice settings", "Couldn't save the voice staff roles. Try again?");
  }
}

/** Lifts a rename block staff set with /voice-rename-block. */
export async function unblockVoiceRenameAction(discordUserId: string): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const parsed = snowflakeSchema.safeParse(discordUserId);
    if (!parsed.success) throw new DashboardError("That member isn't blocked anymore. Refresh the page?");

    const lifted = await unblockVoiceRename(supabaseAdmin, guildId, parsed.data);
    if (!lifted) throw new DashboardError("That member isn't blocked anymore. Refresh the page?");
    await recordChange({
      userId,
      guildId,
      section: "voice",
      action: "delete",
      before: { rename_block: { discord_user_id: lifted.discord_user_id, username: lifted.username, reason: lifted.reason } },
    });
    return finish(guildId);
  } catch (error) {
    return toActionError(error, "lift voice rename block", "Couldn't lift the block. Try again?");
  }
}
