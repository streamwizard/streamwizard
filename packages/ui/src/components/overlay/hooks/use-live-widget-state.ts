"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeToWsRoom } from "../lib/ws-store";
import type { OverlayScene } from "../types/item";
import { ALERT_TEST_BROWSER_EVENT, type AlertTestBrowserEventDetail } from "../widgets/alert/alert-widget-config";
import { useOverlayWsUrl } from "./use-overlay-ws-url";

export type LiveFetchStatus = "loading" | "ready" | "missing_scope" | "failed";

/**
 * On the live overlay a test (Live mode) steps aside for the real data after
 * this long. The editor keeps it until the settings' reset.
 */
const DEMO_CLEAR_MS = 15_000;

export interface LiveWidgetSpec<TBody, TFetched, TState, TFrame> {
  /**
   * Read from `/api/twitch/assets/<resource>` in the editor (dashboard
   * session) and `/api/twitch/<resource>` on the overlay (subscriber token).
   */
  resource: string;
  /** The fetched data from the JSON body. Called with `{}` for the empty value. */
  parse: (body: TBody) => TFetched;
  /** Whether a first fetch has anything to seed. */
  hasData: (fetched: TFetched) => boolean;
  /** The state with nothing in it. */
  empty: () => TState;
  seed: (prev: TState, fetched: TFetched) => TState;
  applyFrame: (prev: TState, frame: TFrame, now: number) => TState;
  isDemoFrame: (frame: TFrame) => boolean;
  /** Browser event (detail `{ sceneId }`) the settings send to drop the tests and read Twitch again. */
  resetEvent: string;
}

/**
 * Loads the channel's data once, and again after each reset. The overlay asks
 * its own origin with the scene's subscriber token; the editor asks the
 * dashboard with the session.
 */
function useFetched<TBody, TFetched>(
  spec: LiveWidgetSpec<TBody, TFetched, unknown, unknown>,
  isEditor: boolean,
  token: string | undefined,
  refreshKey: number,
) {
  const [result, setResult] = useState<{ status: LiveFetchStatus; data: TFetched }>(() => ({
    status: "loading",
    data: spec.parse({} as TBody),
  }));

  useEffect(() => {
    if (!isEditor && !token) return;
    let cancelled = false;
    const url = isEditor ? `/api/twitch/assets/${spec.resource}` : `/api/twitch/${spec.resource}`;
    const init: RequestInit | undefined = isEditor
      ? undefined
      : { headers: { Authorization: `Bearer ${token}` } };
    (async () => {
      try {
        const res = await fetch(url, init);
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as TBody & { missing_scope?: boolean };
        if (cancelled) return;
        setResult({ status: body.missing_scope ? "missing_scope" : "ready", data: spec.parse(body) });
      } catch {
        if (!cancelled) setResult({ status: "failed", data: spec.parse({} as TBody) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spec, isEditor, token, refreshKey]);

  return result;
}

/**
 * A Twitch-backed widget's live data: fetched once, then kept current from
 * the scene's WS room. Test frames (Live mode through the room, or Local mode
 * as a browser event in the editor) go to `demo`, apart from the real
 * `state`, so the settings' reset drops the tests while the real data keeps
 * tracking underneath. On the live overlay nobody is there to press reset,
 * so tests clear themselves.
 *
 * `spec` must be stable (declare it at module level).
 */
export function useLiveWidgetState<TBody, TFetched, TState, TFrame>(
  spec: LiveWidgetSpec<TBody, TFetched, TState, TFrame>,
  { scene, isEditor }: { scene?: OverlayScene; isEditor: boolean },
) {
  const token = scene?.subscriber_token;
  const [refreshKey, setRefreshKey] = useState(0);
  const fetched = useFetched(spec as LiveWidgetSpec<TBody, TFetched, unknown, unknown>, isEditor, token, refreshKey);
  const [state, setState] = useState<TState>(spec.empty);
  const [demo, setDemo] = useState<TState>(spec.empty);
  const [demoAt, setDemoAt] = useState<number | null>(null);
  const replaceOnFetch = useRef(false);

  useEffect(() => {
    if (replaceOnFetch.current) {
      // After a reset the fetch is the truth, including "nothing any more".
      if (fetched.status === "loading") return;
      replaceOnFetch.current = false;
      setState(spec.seed(spec.empty(), fetched.data));
      return;
    }
    if (spec.hasData(fetched.data)) setState((prev) => spec.seed(prev, fetched.data));
  }, [fetched, spec]);

  const apply = useCallback(
    (frame: TFrame) => {
      const now = Date.now();
      if (spec.isDemoFrame(frame)) {
        setDemo((prev) => spec.applyFrame(prev, frame, now));
        setDemoAt(now);
        return;
      }
      setState((prev) => spec.applyFrame(prev, frame, now));
    },
    [spec],
  );

  // Live events over the scene's shared WS room.
  const wsUrl = useOverlayWsUrl();
  useEffect(() => {
    if (!token || !wsUrl) return;
    return subscribeToWsRoom(token, wsUrl, (raw) => apply(raw as TFrame));
  }, [token, wsUrl, apply]);

  // Editor: Local test fires arrive as a browser event.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onTest = (e: Event) => {
      const detail = (e as CustomEvent<AlertTestBrowserEventDetail>).detail;
      if (!detail || (scene && detail.sceneId !== scene.id)) return;
      apply(detail.message as TFrame);
    };
    window.addEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
    return () => window.removeEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
  }, [scene, apply]);

  // Editor: the settings' reset drops the tests and reads Twitch again.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onReset = (e: Event) => {
      const detail = (e as CustomEvent<{ sceneId: string }>).detail;
      if (!detail || (scene && detail.sceneId !== scene.id)) return;
      setDemo(spec.empty());
      setDemoAt(null);
      replaceOnFetch.current = true;
      setRefreshKey((k) => k + 1);
    };
    window.addEventListener(spec.resetEvent, onReset);
    return () => window.removeEventListener(spec.resetEvent, onReset);
  }, [scene, spec]);

  // Live overlay: nobody is there to press reset, so tests clear themselves.
  useEffect(() => {
    if (isEditor || demoAt === null) return;
    const id = setTimeout(() => {
      setDemo(spec.empty());
      setDemoAt(null);
    }, Math.max(0, demoAt + DEMO_CLEAR_MS - Date.now()));
    return () => clearTimeout(id);
  }, [isEditor, demoAt, spec]);

  return { state, demo, status: fetched.status };
}
