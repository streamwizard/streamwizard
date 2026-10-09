"use client";

import posthog from "posthog-js";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function PostHogPageView() {
  const pathname = usePathname();

  // A page view is a new path. The clips page writes every filter, sort and
  // page number to the query string, and counting each of those as a view put
  // it at the top of "most visited" for the wrong reason. The query string
  // still travels with the view that does count (UTM tags on a landing).
  useEffect(() => {
    if (pathname) posthog.capture("$pageview", { $current_url: window.location.href });
  }, [pathname]);

  return null;
}
