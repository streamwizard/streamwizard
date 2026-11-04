"use client";

import { useCallback, useEffect, useState } from "react";
import { env } from "@/lib/env";
import { useOverlayStore } from "@/stores/overlay-editor-store";
import { ALERT_TEST_BROWSER_EVENT, subscribeToWsRoom, type AlertTestBrowserEventDetail } from "@repo/ui/overlay";

export type TwitchAssetResponse<TReady extends object> =
  | { status: "loading" }
  | { status: "failed" }
  | ({ status: "ready" } & TReady);

export interface TwitchAssetSpec<TBody, TReady extends object> {
  /** Read from `/api/twitch/assets/<resource>`. */
  resource: string;
  /** The fields of the ready response, from the JSON body. */
  ready: (body: TBody) => TReady;
}

/** The fields most asset routes send next to their data. */
export interface TwitchAccountBody {
  missing_scope?: boolean;
  login?: string | null;
}

/** Whether the channel still needs a scope, and its login for the Twitch links. */
export function twitchAccount(body: TwitchAccountBody): { missingScope: boolean; login: string | null } {
  return {
    missingScope: body.missing_scope === true,
    login: typeof body.login === "string" && body.login ? body.login : null,
  };
}

/**
 * Reads one Twitch asset route through the dashboard session, and again on
 * `refresh()`. `onBody` gets the body in the same update as the response,
 * with `refetch` true for every read after the first.
 *
 * `spec` and `onBody` must be stable (a module-level spec, a memoised
 * callback); a new one reads the route again.
 */
export function useTwitchAsset<TBody, TReady extends object>(
  spec: TwitchAssetSpec<TBody, TReady>,
  onBody?: (body: TBody, refetch: boolean) => void,
) {
  const [response, setResponse] = useState<TwitchAssetResponse<TReady>>({ status: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/twitch/assets/${spec.resource}`);
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as TBody;
        if (cancelled) return;
        onBody?.(body, refreshKey > 0);
        setResponse({ status: "ready", ...spec.ready(body) });
      } catch {
        if (!cancelled) setResponse({ status: "failed" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spec, onBody, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  return { response, refresh };
}

export interface TwitchWidgetFeedSpec<TBody, TReady extends object, TState, TFrame>
  extends TwitchAssetSpec<TBody, TReady> {
  /** The state before anything is read, and what a refetch after a reset starts from. */
  empty: () => TState;
  /** Folds a fetched body into the state. */
  seed: (prev: TState, body: TBody) => TState;
  applyFrame: (prev: TState, frame: TFrame, now: number) => TState;
  /** A test frame: it marks the panel as testing instead of changing the state. */
  isDemoFrame: (frame: TFrame) => boolean;
  /** Browser event that drops the test data on the canvas (detail: `{ sceneId }`). */
  resetEvent: string;
}

/**
 * A Twitch-backed widget's data for its settings panel: fetched once, then kept
 * current from the scene's WS room, the same frames the canvas widget reads.
 * Test frames are left out; they aren't on Twitch. `testing` says one reached
 * the canvas (through the room in Live mode, or as a local test event), so
 * the panel can offer `reset`, which drops the test data on the canvas and
 * reads Twitch again, here and there.
 *
 * `spec` must be stable (declare it at module level).
 */
export function useTwitchWidgetFeed<TBody, TReady extends object, TState, TFrame>(
  spec: TwitchWidgetFeedSpec<TBody, TReady, TState, TFrame>,
) {
  const [state, setState] = useState<TState>(spec.empty);
  const [testing, setTesting] = useState(false);
  const token = useOverlayStore((s) => s.scene?.subscriber_token);
  const sceneId = useOverlayStore((s) => s.scene?.id);

  // A refetch after a reset is the truth, so it replaces rather than merges.
  const onBody = useCallback(
    (body: TBody, refetch: boolean) => setState((prev) => spec.seed(refetch ? spec.empty() : prev, body)),
    [spec],
  );
  const { response, refresh } = useTwitchAsset(spec, onBody);

  useEffect(() => {
    const wsUrl = env.NEXT_PUBLIC_WS_SERVER_URL;
    if (!token || !wsUrl) return;
    return subscribeToWsRoom(token, wsUrl, (raw) => {
      const frame = raw as TFrame;
      if (spec.isDemoFrame(frame)) {
        // A Live-mode test: it reached the canvas through the room.
        setTesting(true);
        return;
      }
      setState((prev) => spec.applyFrame(prev, frame, Date.now()));
    });
  }, [token, spec]);

  // Local-mode tests, from the panel's Test buttons or the demo bar.
  useEffect(() => {
    const onTest = (e: Event) => {
      const detail = (e as CustomEvent<AlertTestBrowserEventDetail>).detail;
      if (detail && detail.sceneId === sceneId && spec.isDemoFrame(detail.message as TFrame)) setTesting(true);
    };
    window.addEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
    return () => window.removeEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
  }, [sceneId, spec]);

  const reset = useCallback(() => {
    if (!sceneId) return;
    setTesting(false);
    refresh();
    window.dispatchEvent(new CustomEvent<{ sceneId: string }>(spec.resetEvent, { detail: { sceneId } }));
  }, [sceneId, refresh, spec]);

  return { response, state, testing, reset };
}
