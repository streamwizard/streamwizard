"use client";

import { useEffect, useRef } from "react";
import { captureEvent, captureEventOnLeave, type ContentProps } from "@repo/posthog";
import { classifyLink, depthsPassed, type ReadDepth } from "@/lib/cms/tracking";

/*
 * Reading analytics for one post or guide: a view, how far through the body
 * the reader got, how long the tab was visible, and which links in the body
 * they followed. Renders nothing. The server page passes the same props to
 * every visitor; everything per-visitor happens here, after hydration, so the
 * cached page stays the same for everyone.
 *
 * content_read_time is sent each time the tab is hidden or left, with the
 * seconds since the last send: add them up for the time a view took.
 */
export function ContentTracker({ content }: { content: ContentProps }) {
  // Refs, not closure variables: a Strict Mode remount must not send twice.
  const viewed = useRef(false);
  const depths = useRef(new Set<ReadDepth>());

  useEffect(() => {
    if (!viewed.current) {
      viewed.current = true;
      captureEvent("content_viewed", content);
    }

    const body = document.querySelector<HTMLElement>("[data-cms-body]");
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (!body) return;
      const rect = body.getBoundingClientRect();
      for (const depth of depthsPassed(rect.top, rect.height, window.innerHeight)) {
        if (depths.current.has(depth)) continue;
        depths.current.add(depth);
        captureEvent("content_read_depth_reached", { ...content, depth });
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    // Visible time only: a tab left open in the background isn't reading.
    let visibleSince = document.visibilityState === "visible" ? performance.now() : null;
    let banked = 0;
    const send = () => {
      if (visibleSince !== null) {
        banked += performance.now() - visibleSince;
        visibleSince = null;
      }
      const seconds = Math.round(banked / 1000);
      if (seconds < 1) return;
      banked = 0;
      captureEventOnLeave("content_read_time", { ...content, active_seconds: seconds });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") send();
      else visibleSince = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", send);

    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!link || !body?.contains(link)) return;
      const target = classifyLink(link.getAttribute("href") ?? "", window.location.href);
      if (target) captureEvent("content_link_clicked", { ...content, ...target });
    };
    document.addEventListener("click", onClick);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", send);
      document.removeEventListener("click", onClick);
      // Leaving for another page in the app: count the time spent here.
      send();
    };
  }, [content]);

  return null;
}
