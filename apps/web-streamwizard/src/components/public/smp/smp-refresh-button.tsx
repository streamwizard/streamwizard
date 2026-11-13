"use client";

import { useRouterRefresh } from "@/hooks/use-router-refresh";

/* Asks the server again where the visitor stands: after joining the Discord server, or after a failed check. */
export function SmpRefreshButton({ label, primary = false }: { label: string; primary?: boolean }) {
  const { refresh, pending } = useRouterRefresh();

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={pending}
      className={primary ? "pixel-btn pixel-btn-primary" : "pixel-btn"}
    >
      {pending ? "Checking…" : label}
    </button>
  );
}
