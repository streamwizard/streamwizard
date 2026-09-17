import { escapeMarkdown, type APIEmbedField, type EmbedBuilder } from "discord.js";
import { isPlatformEventType, type PlatformEventPayloads, type PlatformEventType } from "@repo/types";
import type { PlatformEvent } from "@repo/supabase/queries/platform-events";
import { formatTicketNumber } from "@repo/supabase/queries/tickets";
import {
  DESCRIPTION_MAX,
  base,
  bold,
  changeLines,
  channelMention,
  code,
  codeList,
  describeLines,
  discordDate,
  discordMention,
  discordUser,
  duration,
  field,
  formatNumber,
  httpsUrl,
  plain,
  quote,
  sentenceCase,
  setAuthor,
  truncate,
  twitchLink,
  twitchUrl,
  withMember,
  type Formatter,
} from "./embed-kit";
import { SERVER_FORMATTERS } from "./server-formatters";

export { formatSettingValue } from "./embed-kit";

// One embed per event type (SW-334). Platform events live here; Discord
// server events in server-formatters.ts.
//
// Layout, top to bottom:
//   author     who it's about (the admin, for dashboard events), with avatar
//   title      emoji + event label
//   thumbnail  the user's profile picture
//   body       one sentence, then inline fields (identity, plan, who did it)
//   footer     event number, and when it happened (not when it was posted)

interface Identity {
  display_name?: string | null;
  twitch_username?: string | null;
  twitch_user_id?: string | null;
  discord_user_id?: string | null;
  avatar_url?: string | null;
  actor_twitch_username?: string | null;
  actor_avatar_url?: string | null;
}

/** Plain name for sentences and the author line: Twitch login, else display name. */
function subjectName(payload: Identity): string | null {
  return payload.twitch_username ?? payload.display_name ?? null;
}

/** Author line and thumbnail for the user the event is about. */
function withSubject(embed: EmbedBuilder, payload: Identity): EmbedBuilder {
  const avatar = httpsUrl(payload.avatar_url);
  setAuthor(embed, subjectName(payload), avatar, twitchUrl(payload.twitch_username));
  if (avatar) embed.setThumbnail(avatar);
  return embed;
}

/** Author line for the admin behind a dashboard action. */
function withActor(embed: EmbedBuilder, payload: Identity): EmbedBuilder {
  return setAuthor(
    embed,
    payload.actor_twitch_username,
    payload.actor_avatar_url,
    twitchUrl(payload.actor_twitch_username),
  );
}

// The subject is always identifiable: Twitch, else display name, else the
// StreamWizard user id from the row.
function identityFields(payload: Identity, event: PlatformEvent): APIEmbedField[] {
  const twitch = twitchLink(payload.twitch_username);
  const account = twitch ? null : plain(payload.display_name);
  return [
    ...field("Twitch", twitch),
    ...field("Twitch ID", code(payload.twitch_user_id)),
    ...field("Account", account),
    ...field("User ID", !twitch && !account ? code(event.subject_user_id) : null),
    ...field("Discord", discordMention(payload.discord_user_id)),
  ];
}

interface PlanPayload extends Identity {
  product_id?: string;
  plan_id?: string;
  plan_name?: string | null;
  status?: string | null;
  expires_at?: string | null;
}

function planName(payload: PlanPayload): string {
  return escapeMarkdown(payload.plan_name ?? payload.plan_id ?? "a plan");
}

function planFields(payload: PlanPayload): APIEmbedField[] {
  return [
    ...field("Plan", plain(payload.plan_name) ?? code(payload.plan_id)),
    ...field("Product", code(payload.product_id)),
    ...field("Status", sentenceCase(payload.status)),
    ...field("Expires", discordDate(payload.expires_at), false),
  ];
}

function byField(label: string, payload: Identity): APIEmbedField[] {
  return field(label, twitchLink(payload.actor_twitch_username));
}

// ── Tickets ─────────────────────────────────────────────────────────────────

type TicketPayload = Partial<PlatformEventPayloads["ticket.opened"]>;

const ticketNumber = (payload: TicketPayload) =>
  payload.ticket_number ? formatTicketNumber(payload.ticket_number) : "a ticket";

/** "ticket #0012" linked to the dashboard page when the bot knows it, else the channel mention. */
function ticketLink(payload: TicketPayload): string {
  const label = `ticket ${ticketNumber(payload)}`;
  const url = httpsUrl(payload.dashboard_url);
  if (url) return `[${label}](${url})`;
  return channelMention(payload.channel?.id) ? `${label} (${channelMention(payload.channel?.id)})` : label;
}

const fromDashboard = (payload: TicketPayload) => (payload.source === "dashboard" ? " from the dashboard" : "");

// A close nobody clicked for has no actor, so the sentence says why instead of who.
const SYSTEM_CLOSE_CAUSES: Record<string, string> = {
  channel_deleted: " because its channel was deleted",
  member_left: " because the opener left the server",
  inactivity: " after going quiet",
};

// Leaves a leading "[" alone, so a linked "[ticket #0012](…)" still starts with a capital.
const upperFirst = (text: string) => text.replace(/[a-z]/, (letter) => letter.toUpperCase());

function ticketFields(payload: TicketPayload, event: PlatformEvent): APIEmbedField[] {
  return [
    ...field("Subject", plain(payload.subject), false),
    ...field("Category", sentenceCase(payload.category)),
    ...field("Product", sentenceCase(payload.product)),
    ...field("Opened by", discordUser(payload.opener, "Unknown")),
    ...field(
      "StreamWizard",
      twitchLink(payload.twitch_username) ?? (payload.opener ? null : code(event.subject_user_id)),
    ),
  ];
}

type PlatformOnly = Exclude<PlatformEventType, keyof typeof SERVER_FORMATTERS>;

const PLATFORM_FORMATTERS: { [T in PlatformOnly]: Formatter<T> } = {
  "user.created": (payload, event) =>
    withSubject(base(event, "user.created"), payload)
      .setDescription(`${bold(subjectName(payload), "Someone")} just signed up for StreamWizard.`)
      .addFields(identityFields(payload, event)),

  "user.deleted": (payload, event) =>
    withSubject(base(event, "user.deleted"), payload)
      .setDescription(
        payload.reason === "twitch_revoked"
          ? `Removed ${bold(subjectName(payload), "a user")}'s account and data. They disconnected StreamWizard on Twitch.`
          : `Removed ${bold(subjectName(payload), "a user")}'s account and data.`,
      )
      .addFields([...identityFields(payload, event), ...field("Reason", sentenceCase(payload.reason))]),

  "admin.role_granted": (payload, event) =>
    withSubject(base(event, "admin.role_granted"), payload)
      .setDescription(`${bold(subjectName(payload), "A user")} is now **${escapeMarkdown(payload.role ?? "admin")}**.`)
      .addFields([...identityFields(payload, event), ...field("By", "Database")]),

  "admin.role_revoked": (payload, event) =>
    withSubject(base(event, "admin.role_revoked"), payload)
      .setDescription(
        `${bold(subjectName(payload), "A user")} is no longer **${escapeMarkdown(payload.role ?? "admin")}**.`,
      )
      .addFields([...identityFields(payload, event), ...field("By", "Database")]),

  "feedback.submitted": (payload, event) =>
    describeLines(withSubject(base(event, "feedback.submitted"), payload), [
      `${bold(subjectName(payload), "Someone")} sent feedback: **${escapeMarkdown(payload.title ?? "Untitled")}**`,
      payload.description ? quote(payload.description, "No description") : "",
    ]).addFields([
      ...field("Category", sentenceCase(payload.category)),
      ...field("Priority", sentenceCase(payload.priority)),
      ...field("Contact", plain(payload.contact)),
      ...identityFields(payload, event),
      ...field("Feedback ID", code(payload.feedback_id)),
    ]),

  "clips.sync_started": (payload, event) =>
    withSubject(base(event, "clips.sync_started"), payload)
      .setDescription(`Syncing ${bold(subjectName(payload), "a user")}'s Twitch clips.`)
      .addFields([
        ...identityFields(payload, event),
        ...field("Previous sync", discordDate(payload.last_sync, "First sync"), false),
      ]),

  "clips.sync_completed": (payload, event) =>
    withSubject(base(event, "clips.sync_completed"), payload)
      .setDescription(
        `Synced ${typeof payload.clip_count === "number" ? formatNumber(payload.clip_count) : "some"} clip${payload.clip_count === 1 ? "" : "s"} for ${bold(subjectName(payload), "a user")}.`,
      )
      .addFields([...identityFields(payload, event), ...field("Took", duration(payload.duration_seconds))]),

  "clips.sync_failed": (payload, event) =>
    withSubject(base(event, "clips.sync_failed"), payload)
      .setDescription(`Clip sync for ${bold(subjectName(payload), "a user")} failed.`)
      .addFields([
        ...field("Error", payload.error ? quote(payload.error, "Unknown") : "*Unknown*", false),
        ...identityFields(payload, event),
        ...field("Failed after", duration(payload.duration_seconds)),
      ]),

  "twitch.token_refresh_failed": (payload, event) =>
    withSubject(base(event, "twitch.token_refresh_failed"), payload)
      .setDescription(
        `Couldn't refresh ${bold(subjectName(payload), "a user")}'s Twitch token. Their StreamWizard features stop working until they log in again.`,
      )
      .addFields([
        ...field("Error", payload.error ? quote(payload.error, "Unknown") : "*Unknown*", false),
        ...field("Status", payload.status ? String(payload.status) : null),
        ...identityFields(payload, event),
      ]),

  "stream.online_failed": (payload, event) =>
    describeLines(withSubject(base(event, "stream.online_failed"), payload), [
      `${bold(subjectName(payload), "A user")} went live, but StreamWizard couldn't start tracking the stream.`,
      payload.reason === "vod_not_found"
        ? "No VOD was found for this stream. VODs may be turned off on Twitch, so no stream page or clip markers this time."
        : payload.reason === "stream_not_found"
          ? "Twitch reported the stream online, then didn't return it. It may have ended straight away."
          : "",
    ]).addFields([
      ...field("Reason", code(payload.reason)),
      ...field("Stream ID", code(payload.stream_id)),
      ...identityFields(payload, event),
    ]),

  "ticket.opened": (payload, event) =>
    withMember(base(event, "ticket.opened"), payload.opener)
      .setDescription(`${discordUser(payload.opener, "Someone")} opened ${ticketLink(payload)}.`)
      .addFields(ticketFields(payload, event)),

  "ticket.claimed": (payload, event) =>
    withMember(base(event, "ticket.claimed"), payload.opener)
      .setDescription(
        `${discordUser(payload.actor, "Someone")} claimed ${ticketLink(payload)}${fromDashboard(payload)}.`,
      )
      .addFields(ticketFields(payload, event)),

  "ticket.closed": (payload, event) =>
    withMember(base(event, "ticket.closed"), payload.opener)
      .setDescription(
        payload.actor
          ? `${discordUser(payload.actor, "Someone")} closed ${ticketLink(payload)}${fromDashboard(payload)}.`
          : `${upperFirst(ticketLink(payload))} was closed${SYSTEM_CLOSE_CAUSES[payload.close_code ?? ""] ?? ""}.`,
      )
      .addFields([
        ...ticketFields(payload, event),
        ...field("Reason", plain(payload.close_reason), false),
        ...field("Claimed by", payload.claimer ? discordUser(payload.claimer, "Unknown") : "Unclaimed"),
        ...field("Open for", duration(payload.duration_seconds)),
        ...field("Messages", typeof payload.message_count === "number" ? formatNumber(payload.message_count) : null),
      ]),

  "ticket.replied": (payload, event) =>
    withMember(base(event, "ticket.replied"), payload.opener)
      .setDescription(`${bold(payload.author_name, "Staff")} replied to ${ticketLink(payload)} from the dashboard.`)
      .addFields(ticketFields(payload, event)),

  "discord.linked": (payload, event) =>
    withSubject(base(event, "discord.linked"), payload)
      .setDescription(
        `${bold(subjectName(payload), "A user")} linked ${discordMention(payload.discord_user_id) ?? "a Discord account"}.`,
      )
      .addFields([
        ...identityFields(payload, event),
        ...field("Replaced", discordMention(payload.previous_discord_user_id)),
      ]),

  "discord.unlinked": (payload, event) =>
    withSubject(base(event, "discord.unlinked"), payload)
      .setDescription(`${bold(subjectName(payload), "A user")} unlinked their Discord account.`)
      .addFields(identityFields(payload, event)),

  "subscription.granted": (payload, event) =>
    withSubject(base(event, "subscription.granted"), payload)
      .setDescription(`${bold(subjectName(payload), "A user")} now has **${planName(payload)}**.`)
      .addFields([
        ...identityFields(payload, event),
        ...planFields(payload),
        ...field("Replaced", codeList(payload.replaced_plan_ids)),
        ...byField("Granted by", payload),
      ]),

  "subscription.changed": (payload, event) => {
    const changes = Object.entries(payload.changes ?? {}).map(([key, change]) =>
      key === "expires_at"
        ? `**Expires** ${discordDate(change.from)} → ${discordDate(change.to)}`
        : `**${sentenceCase(key)}** ${sentenceCase(change.from) ?? "none"} → ${sentenceCase(change.to) ?? "none"}`,
    );
    const summary = `${bold(subjectName(payload), "A user")}'s **${planName(payload)}** plan changed.`;
    return describeLines(withSubject(base(event, "subscription.changed"), payload), [summary, ...changes]).addFields([
      ...identityFields(payload, event),
      ...planFields(payload),
      ...byField("Changed by", payload),
    ]);
  },

  "subscription.revoked": (payload, event) =>
    withSubject(base(event, "subscription.revoked"), payload)
      .setDescription(`${bold(subjectName(payload), "A user")} lost **${planName(payload)}**.`)
      .addFields([...identityFields(payload, event), ...planFields(payload), ...byField("Revoked by", payload)]),

  "discord_settings.changed": (payload, event) => {
    const who = bold(payload.actor_twitch_username, "Someone");
    const section = escapeMarkdown(payload.section ?? "dashboard");
    const changes = changeLines(payload.changes);
    const summary = changes.length
      ? `${who} changed the **${section}** settings.`
      : `${who} ran \`${payload.action}\` in **${section}**.`;
    return describeLines(withActor(base(event, "discord_settings.changed"), payload), [summary, ...changes]);
  },

  "log.test": (payload, event) =>
    withActor(base(event, "log.test"), payload).setDescription(
      `${bold(payload.actor_twitch_username, "Someone")} sent a test from the dashboard. If you can read this, the log channel works.`,
    ),
};

export const FORMATTERS: { [T in PlatformEventType]: Formatter<T> } = { ...PLATFORM_FORMATTERS, ...SERVER_FORMATTERS };

/** Builds the embed for any stored event, including types this build doesn't know yet. */
export function formatPlatformEvent(event: PlatformEvent): EmbedBuilder {
  const payload = (
    event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? event.payload : {}
  ) as Record<string, never>;
  if (isPlatformEventType(event.event_type)) {
    const format = FORMATTERS[event.event_type] as Formatter<PlatformEventType>;
    return format(payload, event);
  }
  const json = truncate(JSON.stringify(event.payload, null, 2), DESCRIPTION_MAX - 20);
  return base(event, null).setDescription(`\`\`\`json\n${json}\n\`\`\``);
}
