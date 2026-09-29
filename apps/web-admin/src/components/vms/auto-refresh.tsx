"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRefreshInterval } from "@/lib/refresh-interval-context";

/**
 * Re-renders the server page at the header's refresh interval, so VM status,
 * uptime and the tables follow what Proxmox pushes without a reload. Client
 * state (sort, filters, open sections) survives a router refresh. Skipped
 * while the tab is hidden, and once right away when it comes back.
 */
export function AutoRefresh() {
  const router = useRouter();
  const { interval } = useRefreshInterval();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(tick, interval);
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, interval]);

  return null;
}
