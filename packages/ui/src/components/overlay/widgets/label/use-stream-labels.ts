"use client";

// Next.js replaces NEXT_PUBLIC_* at build time; declare process so tsc is happy in this library package.
declare const process: { env: Record<string, string | undefined> };

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  applyLabelEvent,
  emptyLabelSnapshot,
  isLabelEventType,
  type LabelSnapshot,
} from "@repo/schemas";
import { subscribeToWsRoom } from "../../lib/ws-store";
import { ALERT_TEST_BROWSER_EVENT, type AlertTestBrowserEventDetail } from "../alert/alert-widget-config";
import { streamChangedFromFrame, type CreditsWidgetFrame } from "../credits/credits-widget-state";

/**
 * One label snapshot per scene, shared by every Label widget in it.
 *
 * A scene with ten labels makes one HTTP read and holds one socket listener,
 * not ten. The snapshot comes from GET /api/twitch/labels (the dashboard
 * session's /api/twitch/assets/labels in the editor). After that the store
 * runs every raw follow/sub/cheer/... frame the room already delivers through
 * `applyLabelEvent`, the same reducer the server built the snapshot with. No
 * Supabase Realtime and no extra message type.
 *
 * It reads again:
 * - when a stream starts or ends (sys.stream_id / sys.is_live user-state push),
 *   so the session labels start over;
 * - after the socket reconnects, since frames sent while it was down are gone;
 * - every few minutes, which is how the follower and sub counts notice
 *   unfollows and expired subs (Twitch sends no event for either), and how a
 *   redelivered event that got counted twice gets corrected.
 *
 * Local test events from the editor are applied on top and never stored; the
 * settings' reset drops them. Live test events arrive as ordinary frames, so
 * an open overlay shows them until its next read.
 */

/** Browser event the settings dispatch to drop test events and read again. */
export const LABELS_RESET_BROWSER_EVENT = "streamwizard:labels-reset";
export interface LabelsResetBrowserEventDetail {
  sceneId: string;
}

const REFRESH_MS = 5 * 60_000;

export type LabelsStatus = "loading" | "ready" | "failed";

export interface LabelsState {
  status: LabelsStatus;
  /** The stored labels with any test events applied on top. */
  snapshot: LabelSnapshot;
  /** Test events are on screen. */
  demo: boolean;
}

interface StoreOptions {
  isEditor: boolean;
  token: string | undefined;
  sceneId: string | undefined;
}

class LabelStore {
  private listeners = new Set<() => void>();
  private base: LabelSnapshot = emptyLabelSnapshot();
  private demos: { type: string; payload: unknown }[] = [];
  private state: LabelsState = { status: "loading", snapshot: this.base, demo: false };
  private refs = 0;
  private cleanups: (() => void)[] = [];
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private fetchSeq = 0;
  private disconnected = false;

  constructor(private readonly opts: StoreOptions) {}

  getState = (): LabelsState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  retain() {
    this.refs += 1;
    if (this.refs === 1) this.start();
  }

  release() {
    this.refs -= 1;
    if (this.refs === 0) this.stop();
  }

  private start() {
    void this.load();

    const wsUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? "";
    if (this.opts.token && wsUrl) {
      this.cleanups.push(subscribeToWsRoom(this.opts.token, wsUrl, (raw) => this.onFrame(raw)));
    }

    if (typeof window !== "undefined") {
      const onTest = (e: Event) => {
        const detail = (e as CustomEvent<AlertTestBrowserEventDetail>).detail;
        if (!detail || (this.opts.sceneId && detail.sceneId !== this.opts.sceneId)) return;
        this.addDemo(detail.message.type, detail.message.payload);
      };
      const onReset = (e: Event) => {
        const detail = (e as CustomEvent<LabelsResetBrowserEventDetail>).detail;
        if (!detail || (this.opts.sceneId && detail.sceneId !== this.opts.sceneId)) return;
        this.demos = [];
        this.emit();
        void this.load();
      };
      window.addEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
      window.addEventListener(LABELS_RESET_BROWSER_EVENT, onReset);
      this.cleanups.push(() => {
        window.removeEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
        window.removeEventListener(LABELS_RESET_BROWSER_EVENT, onReset);
      });
    }
  }

  private stop() {
    for (const c of this.cleanups.splice(0)) c();
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
    this.fetchSeq += 1;
  }

  private async load() {
    const { isEditor, token } = this.opts;
    if (!isEditor && !token) return;
    const seq = ++this.fetchSeq;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    try {
      const res = await fetch(
        isEditor ? "/api/twitch/assets/labels" : "/api/twitch/labels",
        isEditor ? undefined : { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as LabelSnapshot;
      if (seq !== this.fetchSeq) return;
      const empty = emptyLabelSnapshot();
      this.base = {
        broadcaster_id: body.broadcaster_id ?? null,
        latest: body.latest ?? {},
        session: body.session ?? empty.session,
        helix: body.helix ?? empty.helix,
        history: body.history ?? [],
        period_leaders: { ...empty.period_leaders, ...body.period_leaders },
      };
      this.emit("ready");
    } catch {
      // Keep what we had: one failed read shouldn't blank a label.
      if (seq === this.fetchSeq && this.state.status === "loading") this.emit("failed");
    } finally {
      if (seq === this.fetchSeq && this.refs > 0) {
        this.refreshTimer = setTimeout(() => void this.load(), REFRESH_MS);
      }
    }
  }

  private onFrame(raw: unknown) {
    const frame = raw as { type?: string; payload?: unknown } | null;
    if (!frame?.type) return;
    if (frame.type === "ws:close" || frame.type === "ws:connecting") {
      if (this.state.status !== "loading") this.disconnected = true;
      return;
    }
    if (frame.type === "ws:open") {
      if (this.disconnected) {
        this.disconnected = false;
        void this.load();
      }
      return;
    }
    if (streamChangedFromFrame(frame as CreditsWidgetFrame)) {
      void this.load();
      return;
    }
    if (!isLabelEventType(frame.type)) return;
    const next = applyLabelEvent(this.base, frame.type, frame.payload);
    if (next === this.base) return;
    this.base = next;
    this.emit();
  }

  private addDemo(type: string, payload: unknown) {
    if (!isLabelEventType(type)) return;
    this.demos = [...this.demos, { type, payload }];
    this.emit();
  }

  private emit(status: LabelsStatus = this.state.status) {
    // Test events always count toward the session, so the preview moves
    // even while the channel is offline.
    const snapshot = this.demos.reduce(
      (snap, d) => applyLabelEvent(snap, d.type, d.payload, { forceSession: true }),
      this.base,
    );
    this.state = { status, snapshot, demo: this.demos.length > 0 };
    for (const l of this.listeners) l();
  }
}

const stores = new Map<string, LabelStore>();

function storeKey({ isEditor, token, sceneId }: StoreOptions): string {
  return `${isEditor ? "editor" : "overlay"}:${token ?? ""}:${sceneId ?? ""}`;
}

function acquire(opts: StoreOptions): LabelStore {
  const key = storeKey(opts);
  let store = stores.get(key);
  if (!store) {
    store = new LabelStore(opts);
    stores.set(key, store);
  }
  return store;
}

const SERVER_STATE: LabelsState = { status: "loading", snapshot: emptyLabelSnapshot(), demo: false };

export function useStreamLabels(opts: StoreOptions): LabelsState {
  const key = storeKey(opts);
  // Stores stay in the map once made (one per scene and mode, tiny), so a
  // Strict Mode unmount/remount or a quick remount reuses the same instance
  // and the component is never subscribed to a store that was thrown away.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const store = useMemo(() => acquire(opts), [key]);

  useEffect(() => {
    store.retain();
    return () => store.release();
  }, [store]);

  return useSyncExternalStore(store.subscribe, store.getState, () => SERVER_STATE);
}
