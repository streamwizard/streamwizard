"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeChannel, type RealtimeChannel } from "@/hooks/use-realtime-channel";

const SETTLE_MS = 400;

/**
 * Re-renders the ticket list when any ticket in the guild is opened or
 * changes. The list is filtered and paged on the server, so a refresh is the
 * honest way to reflect a change; it costs Supabase reads only, since guild
 * data and profiles are cached. Bursts (a close writes several columns and
 * events) collapse into one refresh.
 */
export function TicketListLive({ guildId }: { guildId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refresh = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), SETTLE_MS);
  }, [router]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const build = useCallback(
    (channel: RealtimeChannel) =>
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "discord_tickets", filter: `guild_id=eq.${guildId}` },
        refresh,
      ),
    [guildId, refresh],
  );
  useRealtimeChannel(`tickets:${guildId}`, build, refresh);

  return null;
}
