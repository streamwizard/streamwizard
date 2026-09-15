import Link from "next/link";
import { Activity, DoorOpen, ScrollText, ShieldCheck, Ticket, type LucideIcon } from "lucide-react";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getGuildCommandPermissions, getGuildSettings } from "@repo/supabase/queries/discord";
import { getActivitySettings, getIgnoredChannelIds } from "@repo/supabase/queries/discord-activity";
import { listDiscordSettingsAudit } from "@repo/supabase/queries/discord-audit";
import { getLogRouting, resolveLogRoute } from "@repo/supabase/queries/platform-events";
import { countOpenTickets, getTicketSettings } from "@repo/supabase/queries/tickets";
import { PLATFORM_EVENT_TYPES } from "@repo/types";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { AuditList } from "@/components/discord/audit-list";
import { PageHeader } from "@/components/widgets/page-header";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import { getGuild, getGuildChannels, getGuildRoles, requireDiscordContext } from "@/lib/discord/api";
import { buildNameMap } from "@/lib/discord/names";

export const dynamic = "force-dynamic";

function FeatureCard({
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
    <Link href={href} className="group">
      <Card className="h-full transition-colors group-hover:border-foreground/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm font-medium">
            <span className="flex items-center gap-2">
              <Icon className="size-4 text-muted-foreground" aria-hidden />
              {title}
            </span>
            <StatusIndicator status={enabled ? "ok" : "muted"} label={statusLabel ?? (enabled ? "On" : "Off")} className="text-xs" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0.5 text-sm text-muted-foreground">
          {lines.map((line) => (
            <p key={line} className="truncate">
              {line}
            </p>
          ))}
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function DiscordOverviewPage() {
  const { guildId } = requireDiscordContext();

  const [guild, channels, roles, welcome, activity, ignored, tickets, openTickets, permissions, audit, logRouting] = await Promise.all([
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
  ]);
  const postedEventTypes = PLATFORM_EVENT_TYPES.filter((type) => resolveLogRoute(logRouting, type).enabled).length;

  const names = buildNameMap(channels, roles);
  const label = (id: string | null | undefined, fallback: string) => (id ? (names.get(id) ?? `Unknown (${id})`) : fallback);
  const restrictedCommands = new Set(permissions.map((p) => p.command_name)).size;
  const iconUrl = guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=96` : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Discord" description="Bot settings for the StreamWizard server. Changes apply without restarting the bot." />

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <FeatureCard
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
        <FeatureCard
          href="/discord/activity"
          title="Activity"
          icon={Activity}
          enabled={activity?.tracking_enabled !== false}
          lines={[`${ignored.length} ignored channel${ignored.length === 1 ? "" : "s"}`]}
        />
        <FeatureCard
          href="/discord/tickets"
          title="Tickets"
          icon={Ticket}
          enabled={!!tickets?.enabled}
          lines={[`${openTickets} open`, `Panel: ${label(tickets?.panel_channel_id, "not posted")}`]}
        />
        <FeatureCard
          href="/discord/logs"
          title="Log"
          icon={ScrollText}
          enabled={!!logRouting.defaultChannelId}
          lines={[
            `Default: ${label(logRouting.defaultChannelId, "not set")}`,
            `${postedEventTypes} of ${PLATFORM_EVENT_TYPES.length} event types posted`,
          ]}
        />
        <FeatureCard
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
      </div>

      <AuditList entries={audit} names={names} />
    </div>
  );
}
