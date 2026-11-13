"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-runs the server components of the current route, for "check again"
 * buttons whose answer lives on the server (did the Discord role land yet).
 *
 * `pending` is true until the fresh render has arrived, so the button can show
 * that it is working and comes back when the answer is still the same.
 */
export function useRouterRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());
  return { refresh, pending };
}
