"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@repo/ui";
import { useTicketActivity } from "@/hooks/use-ticket-activity";

interface AutoRefreshProps {
  wsUrl: string | null;
  /** Only refresh for this ticket channel; omit to refresh on any ticket activity (list page). */
  channelId?: string;
  /** Show the "Live" label and manual refresh button. */
  showStatus?: boolean;
}

const POLL_WHEN_LIVE_MS = 60_000;
const POLL_WHEN_OFFLINE_MS = 15_000;

/**
 * Re-renders the server page when the Discord bot pushes ticket activity over
 * ws-server. Polls as a safety net: slowly while the socket is up, every 15s
 * when it isn't.
 */
export function AutoRefresh({ wsUrl, channelId, showStatus = true }: AutoRefreshProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [updatedAt, setUpdatedAt] = useState(() => new Date());

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
    setUpdatedAt(new Date());
  }, [router]);

  const live = useTicketActivity(
    wsUrl,
    useCallback((payload) => {
      if (!channelId || payload.channelId === channelId) refresh();
    }, [channelId, refresh]),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, live ? POLL_WHEN_LIVE_MS : POLL_WHEN_OFFLINE_MS);
    return () => clearInterval(timer);
  }, [live, refresh]);

  if (!showStatus) return null;

  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5" title={live ? "Updates arrive instantly" : "Checking every 15 seconds"}>
        <span className={live ? "size-2 animate-pulse rounded-full bg-emerald-500" : "size-2 rounded-full bg-amber-500"} aria-hidden />
        {live ? "Live" : "Polling"}
      </span>
      <span className="tabular-nums" suppressHydrationWarning>
        updated {updatedAt.toLocaleTimeString("en-GB")}
      </span>
      <Button size="icon" variant="ghost" className="size-7" aria-label="Refresh conversation" disabled={pending} onClick={refresh}>
        <RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden />
      </Button>
    </span>
  );
}
