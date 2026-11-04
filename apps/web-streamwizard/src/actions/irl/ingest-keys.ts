"use server";

import { guidSchema } from "@repo/schemas/ids";
import { reportError } from "@repo/sentry";
import { toActionError } from "@/lib/action-error";

import { randomHexKey } from "@/lib/random-key";
import { env } from "@/lib/env";
import {
  deleteIngestKey as deleteIngestKeyRow,
  type IngestStreamKey,
  insertIngestKey,
  insertOutputKey,
  rotateIngestKeySecret,
  selectIngestKeyForUser,
  selectIngestKeyIds,
  selectIngestKeys,
} from "@repo/supabase/queries/ingest/ingest";
import { tryAuthContext } from "@/lib/auth";
import { ingestKeyLabelSchema } from "@/schemas/ingest";
import { canCreateIngestKeys, INGEST_PLAN_REQUIRED } from "@/lib/obs/ingest-access";
import { track } from "@/lib/tracking/track";
import { createAdminClient } from "@repo/supabase/next/admin";
import { getDiscordUserIdForUser } from "@repo/supabase/queries/discord/discord";
import { getActiveIngestNodeHosts } from "@repo/supabase/queries/ingest/nodes";
import { sendDiscordDirectMessage, type DiscordMessagePayload } from "@repo/discord-api";
import { revalidatePath } from "next/cache";

const INGEST_SETTINGS_PATH = "/dashboard/irl/ingest";

const STREAMWIZARD_BLURPLE = 0x7c5cff;

/** Public host encoders push to — the linked ingest node's public domain when
 * ops has set one, else its public IP, falling back to env/placeholder only
 * when no node is linked. Mirrors CloudObsPage. */
async function resolveIngestHost(adminClient: ReturnType<typeof createAdminClient>): Promise<string> {
  const hosts = await getActiveIngestNodeHosts(adminClient);
  return (
    hosts?.public_hostname ?? hosts?.public_ip ?? env.NEXT_PUBLIC_INGEST_HOST ?? "your-stream-server"
  );
}

function ingestKeyDmEmbed(label: string, streamKey: string, host: string): DiscordMessagePayload {
  return {
    embeds: [
      {
        title: "🔑 Ingest Key",
        description: `**Don't share this. Don't show it on stream.** Anyone who gets this key can stream to your channel.\n\nConnection info for **${label}** is below. Your stream ID is blurred. Tap it to reveal, tap the code block to copy. Most encoders have separate fields for the URL and the stream ID.`,
        color: STREAMWIZARD_BLURPLE,
        fields: [
          { name: "SRT URL", value: `\`\`\`srt://${host}:8888\`\`\`` },
          { name: "SRTLA URL", value: `\`\`\`srtla://${host}:5000\`\`\`` },
          { name: "Stream ID", value: `||\`\`\`${streamKey}\`\`\`||` },
          {
            name: "Key leaked?",
            value: "Rotate it right away from Manage keys below. Streaming won't stop until you do.",
          },
        ],
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "Manage keys",
            url: `${env.NEXT_PUBLIC_BASE_URL}${INGEST_SETTINGS_PATH}`,
          },
        ],
      },
    ],
  };
}

/**
 * Best-effort: DMs the key straight to the user's Discord if they've linked
 * one, so they don't have to type it out on a phone/encoder keyboard. Never
 * throws — a failed DM (e.g. the user has server DMs off) shouldn't block
 * key creation.
 */
async function notifyDiscord(userId: string, label: string, streamKey: string) {
  try {
    const adminClient = createAdminClient();
    // A failed lookup throws into the catch below, which reports it.
    const discordUserId = await getDiscordUserIdForUser(adminClient, userId);
    if (!discordUserId) return;

    const host = await resolveIngestHost(adminClient);
    await sendDiscordDirectMessage(discordUserId, ingestKeyDmEmbed(label, streamKey, host));
  } catch (err) {
    reportError(err, "ingest-keys.notifyDiscord");
  }
}

/** User-triggered resend, from the "Your keys" list — unlike notifyDiscord, this reports back so a missing link or failed send shows up as a real error instead of silently doing nothing. */
export async function sendIngestKeyDiscordDM(id: string): Promise<{ error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { error: "Unauthorized" };
  const { user } = ctx;
  const parsedId = guidSchema.safeParse(id);
  if (!parsedId.success) return { error: "Key not found" };

  const adminClient = createAdminClient();
  const { data: key, error: keyError } = await selectIngestKeyForUser(adminClient, parsedId.data, user.id);
  if (keyError) return { error: toActionError(keyError, "actions/ingest-keys", "Couldn't send that DM. Try again?") };
  if (!key) return { error: "Key not found" };

  const discordUserId = await getDiscordUserIdForUser(adminClient, user.id).catch((error: unknown) => {
    reportError(error, "ingest-keys.discord-lookup");
    return null;
  });
  if (!discordUserId) {
    return { error: "Connect Discord in Settings → Integrations first" };
  }

  try {
    const host = await resolveIngestHost(adminClient);
    await sendDiscordDirectMessage(discordUserId, ingestKeyDmEmbed(key.label, key.stream_key, host));
  } catch (err) {
    // Usually the user has DMs from server members turned off: theirs to fix,
    // not a bug, so it's logged rather than reported.
    console.warn("[ingest-keys] DM failed:", err instanceof Error ? err.message : err);
    return { error: "Couldn't send that DM. Check that Discord lets server members DM you." };
  }

  return { error: null };
}

export async function createIngestKey(label: string): Promise<{ data: IngestStreamKey | null; error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };
  const { user } = ctx;
  const parsedLabel = ingestKeyLabelSchema.safeParse(label);
  if (!parsedLabel.success) return { data: null, error: parsedLabel.error.issues[0]?.message ?? "Invalid name" };
  if (!(await canCreateIngestKeys(ctx.supabase))) return { data: null, error: INGEST_PLAN_REQUIRED };

  const adminClient = createAdminClient();

  // One key per user. If they've got one already, they rotate it, not stack a
  // second one. Guards against a double-click or a stale UI as much as intent.
  const { data: existing } = await selectIngestKeyIds(adminClient, user.id);
  if (existing && existing.length > 0) {
    return { data: null, error: "You've already got an ingest key. Rotate it instead." };
  }

  const { data, error } = await insertIngestKey(adminClient, {
    user_id: user.id,
    stream_key: randomHexKey(),
    label: parsedLabel.data || "My Ingest Key",
  });

  if (error) {
    return { data: null, error: toActionError(error, "actions/ingest-keys", "Couldn't create your ingest key. Try again?") };
  }

  // Every incoming key needs an OBS output key to be pullable. The user never
  // manages this directly, so it's created here rather than surfaced as a step.
  await insertOutputKey(adminClient, {
    user_id: user.id,
    key_id: data.id,
    output_key: randomHexKey(),
    label: "OBS output",
  });

  await notifyDiscord(user.id, data.label, data.stream_key);

  revalidatePath(INGEST_SETTINGS_PATH);
  await track("ingest_key_created", { kind: "ingest" }, user);
  return { data, error: null };
}

export async function listIngestKeys(): Promise<{ data: IngestStreamKey[] | null; error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };
  const { user } = ctx;

  const adminClient = createAdminClient();
  const { data, error } = await selectIngestKeys(adminClient, user.id);

  return { data, error: error ? toActionError(error, "actions/ingest-keys", "Couldn't load your ingest keys. Try again?") : null };
}

export async function rotateIngestKey(id: string): Promise<{ data: IngestStreamKey | null; error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthorized" };
  const { user } = ctx;
  const parsedId = guidSchema.safeParse(id);
  if (!parsedId.success) return { data: null, error: "Key not found" };
  if (!(await canCreateIngestKeys(ctx.supabase))) return { data: null, error: INGEST_PLAN_REQUIRED };

  const adminClient = createAdminClient();
  const { data, error } = await rotateIngestKeySecret(adminClient, parsedId.data, user.id, randomHexKey());

  if (error) {
    return { data: null, error: toActionError(error, "actions/ingest-keys", "Couldn't rotate your ingest key. Try again?") };
  }

  revalidatePath(INGEST_SETTINGS_PATH);
  await track("ingest_key_rotated", { kind: "ingest" }, user);
  return { data, error: null };
}

export async function deleteIngestKey(id: string): Promise<{ error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { error: "Unauthorized" };
  const { user } = ctx;
  const parsedId = guidSchema.safeParse(id);
  if (!parsedId.success) return { error: "Key not found" };

  const adminClient = createAdminClient();
  const { error } = await deleteIngestKeyRow(adminClient, parsedId.data, user.id);

  revalidatePath(INGEST_SETTINGS_PATH);
  if (error) return { error: toActionError(error, "actions/ingest-keys", "Couldn't delete your ingest key. Try again?") };
  await track("ingest_key_deleted", { kind: "ingest" }, user);
  return { error: null };
}
