import Link from "next/link";
import {
  Activity,
  ChevronRight,
  DoorOpen,
  RadioTower,
  ScrollText,
  ShieldCheck,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getGuildCommandPermissions, getGuildSettings } from "@repo/supabase/queries/discord";
import { getActivitySettings, getIgnoredChannelIds } from "@repo/supabase/queries/discord-activity";
import { listDiscordSettingsAudit } from "@repo/supabase/queries/discord-audit";
import { listDiscordLiveOptIns } from "@repo/supabase/queries/discord-live";
import { getLogRouting, resolveLogRoute } from "@repo/supabase/queries/platform-events";
import { countOpenTickets, getTicketSettings } from "@repo/supabase/queries/tickets";
import { PLATFORM_EVENT_TYPES } from "@repo/types";
import { Card, CardContent } from "@repo/ui";
import { AuditList } from "@/components/discord/audit-list";
import { PageHeader } from "@/components/widgets/page-header";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import { getGuild, getGuildChannels, getGuildRoles, requireDiscordContext } from "@/lib/discord/api";
import { buildNameMap } from "@/lib/discord/names";

export const dynamic = "force-dynamic";

/** One line of the feature list: what it is, how it is set up, and whether it is on. */
function FeatureRow({
  href,
  title,
  icon: Icon,
  enabled,
  statusLabel,
  lines,
}: {
  href: string;
  title: string;
  icon: LucideIcon;
  enabled: boolean;
  statusLabel?: string;
  lines: string[];
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="truncate text-sm text-muted-foreground">{lines.join(" · ")}</p>
        </div>
        <StatusIndicator
          status={enabled ? "ok" : "muted"}
          label={statusLabel ?? (enabled ? "On" : "Off")}
          className="shrink-0 text-xs"
        />
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

export default async function DiscordOverviewPage() {
  const { guildId } = requireDiscordContext();

  const [
    guild,
    channels,
    roles,
    welcome,
    activity,
    ignored,
    tickets,
    openTickets,
    permissions,
    audit,
    logRouting,
    liveOptIns,
  ] = await Promise.all([
    getGuild(),
    getGuildChannels(),
    getGuildRoles(),
    getGuildSettings(supabaseAdmin, guildId),
    getActivitySettings(supabaseAdmin, guildId),
    getIgnoredChannelIds(supabaseAdmin, guildId),
    getTicketSettings(supabaseAdmin, guildId),
    countOpenTickets(supabaseAdmin, guildId),
    getGuildCommandPermissions(supabaseAdmin, guildId),
    listDiscordSettingsAudit(supabaseAdmin, guildId, 10),
    getLogRouting(supabaseAdmin, guildId),
    listDiscordLiveOptIns(supabaseAdmin),
  ]);
  const postedEventTypes = PLATFORM_EVENT_TYPES.filter((type) => resolveLogRoute(logRouting, type).enabled).length;

  const names = buildNameMap(channels, roles);
  const label = (id: string | null | undefined, fallback: string) =>
    id ? (names.get(id) ?? `Unknown (${id})`) : fallback;
  const restrictedCommands = new Set(permissions.map((p) => p.command_name)).size;
  const iconUrl = guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=96` : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Server settings"
        description="Bot settings for the StreamWizard server. Changes apply without restarting the bot."
      />

      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          {iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- tiny CDN icon, no next/image config for Discord
            <img src={iconUrl} alt="" className="size-12 rounded-full" />
          ) : (
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-lg font-semibold">
              {guild.name.slice(0, 1)}
            </div>
          )}
          <div>
            <p className="font-semibold">{guild.name}</p>
            <p className="text-sm text-muted-foreground tabular-nums">
              {guild.approximate_member_count?.toLocaleString("en-US") ?? "?"} members
              {guild.approximate_presence_count !== undefined &&
                ` · ${guild.approximate_presence_count.toLocaleString("en-US")} online`}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="py-0">
        <ul className="divide-y">
          <FeatureRow
            href="/discord/welcome"
            title="Welcome"
            icon={DoorOpen}
            enabled={welcome?.welcome_enabled !== false}
            lines={[
              `Channel: ${label(welcome?.welcome_channel_id, "system channel")}`,
              `Join role: ${label(welcome?.join_role_id, "none")}`,
              `Verified role: ${label(welcome?.verified_role_id, "none")}`,
            ]}
          />
          <FeatureRow
            href="/discord/activity"
            title="Activity tracking"
            icon={Activity}
            enabled={activity?.tracking_enabled !== false}
            lines={[`${ignored.length} ignored channel${ignored.length === 1 ? "" : "s"}`]}
          />
          <FeatureRow
            href="/discord/tickets/settings"
            title="Tickets"
            icon={Ticket}
            enabled={!!tickets?.enabled}
            lines={[`${openTickets} open`, `Panel: ${label(tickets?.panel_channel_id, "not posted")}`]}
          />
          <FeatureRow
            href="/discord/logs/settings"
            title="Event log"
            icon={ScrollText}
            enabled={!!logRouting.defaultChannelId}
            lines={[
              `Default: ${label(logRouting.defaultChannelId, "not set")}`,
              `${postedEventTypes} of ${PLATFORM_EVENT_TYPES.length} event types posted`,
            ]}
          />
          <FeatureRow
            href="/discord/live"
            title="Go-live"
            icon={RadioTower}
            enabled={!!welcome?.live_enabled || !!welcome?.live_role_id}
            lines={[
              `Posts: ${welcome?.live_enabled ? label(welcome.live_channel_id, "no channel") : "off"}`,
              `Live role: ${label(welcome?.live_role_id, "off")}`,
              `${liveOptIns.length} streamer${liveOptIns.length === 1 ? "" : "s"} linked`,
            ]}
          />
          <FeatureRow
            href="/discord/permissions"
            title="Permissions"
            icon={ShieldCheck}
            enabled={restrictedCommands > 0}
            statusLabel={restrictedCommands > 0 ? "Restricted" : "Open"}
            lines={[
              restrictedCommands
                ? `${restrictedCommands} restricted command${restrictedCommands === 1 ? "" : "s"}`
                : "Every command is open",
            ]}
          />
        </ul>
      </Card>

      <AuditList entries={audit} names={names} />
    </div>
  );
}
