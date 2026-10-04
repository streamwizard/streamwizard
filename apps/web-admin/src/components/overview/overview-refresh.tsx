"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const EVERY_MS = 60_000;

/** Re-reads the dashboard once a minute while the tab is visible, and right away when it comes back. */
export function OverviewRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refresh, EVERY_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  return null;
}
