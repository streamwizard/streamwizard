"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type InputEvent, parseInputEvent } from "./input-events";

// obs-websocket v5 op codes
const OP_HELLO = 0;
const OP_IDENTIFY = 1;
const OP_IDENTIFIED = 2;
const OP_REQUEST = 6;
const OP_REQUEST_RESPONSE = 7;
const OP_REQUEST_BATCH = 8;
const OP_REQUEST_BATCH_RESPONSE = 9;
const OP_EVENT = 5;

const REQUEST_TIMEOUT_MS = 10_000;

interface BatchResult {
  requestStatus: { result: boolean; code: number; comment?: string };
  responseData?: unknown;
}

// General | Scenes | Inputs | Outputs | SceneItems | Vendors. Inputs carries
// renames and settings changes; the per-frame volume meters are a separate
// high-volume group and stay off.
const EVENT_SUBSCRIPTIONS = (1 << 0) | (1 << 2) | (1 << 3) | (1 << 6) | (1 << 7) | (1 << 9);

// Input events that change what sceneItems or a source's settings say.
// The rest of the Inputs group (mute, volume, audio sync) is ignored.
const INPUT_REFRESH_EVENTS = new Set(["InputNameChanged", "InputSettingsChanged", "InputCreated", "InputRemoved"]);

// Removing several sources at once fires one event each; one scene refresh
// after they settle is enough.
const SCENE_ITEM_REFRESH_DELAY_MS = 250;

export type ObsConnectionStatus = "closed" | "connecting" | "open";

export interface Scene {
  sceneName: string;
  sceneIndex: number;
  // Stable across renames — the auto switcher stores scenes by uuid so a
  // renamed scene doesn't break switching.
  sceneUuid: string;
}

export interface SceneItem {
  sceneItemId: number;
  sourceUuid: string;
  sourceName: string;
  /** The input's kind (`ffmpeg_source`, `browser_source`, ...); null for a nested scene or group. */
  inputKind?: string | null;
}

/** A source taken out of a scene, by anyone connected to this OBS. */
export interface SceneItemRemovedEvent {
  sceneName: string;
  sourceName: string;
}

export interface SourceStatNode {
  name: string;
  category: string;
  sourceType?: string;
  displayName?: string;
  kindId?: string;
  uuid?: string;
  width?: number;
  height?: number;
  active: boolean;
  rendered?: boolean;
  enabled: boolean;
  async: boolean;
  filter: boolean;
  private?: boolean;
  childCount?: number;
  cpuPercentage?: number;
  gpuPercentage?: number;
  totalPercentage?: number;
  tickAvg?: number;
  renderAvg?: number;
  renderTotal?: number;
  renderGpuTotal?: number;
  total?: number;
  asyncInputFps?: number;
  asyncRenderedFps?: number;
  children: SourceStatNode[];
}

export interface ObsStats {
  cpuUsage: number;
  memoryUsage: number;
  activeFps: number;
  averageFrameRenderTime: number;
  renderSkippedFrames: number;
  outputSkippedFrames: number;
}

export interface SourceStatsPayload {
  frameTime: number;
  sources: SourceStatNode[];
}

// obs-websocket v5 auth: base64(sha256(base64(sha256(password + salt)) + challenge))
async function computeAuth(password: string, salt: string, challenge: string): Promise<string> {
  const enc = new TextEncoder();
  const secretHash = await crypto.subtle.digest("SHA-256", enc.encode(password + salt));
  const secret = btoa(String.fromCharCode(...new Uint8Array(secretHash)));
  const authHash = await crypto.subtle.digest("SHA-256", enc.encode(secret + challenge));
  return btoa(String.fromCharCode(...new Uint8Array(authHash)));
}

interface UseObsWebSocketOptions {
  getWsUrl: (() => Promise<string>) | null;
  password: string | null;
}

const RETRY_DELAY_MS = 3_000;
const MAX_AUTO_RETRIES = 30; // ~90 seconds of waiting

export function useObsWebSocket({ getWsUrl, password }: UseObsWebSocketOptions) {
  const socketRef = useRef<WebSocket | null>(null);
  const connectingRef = useRef(false);
  const pendingRef = useRef<Map<string, { resolve: (data: unknown) => void; reject: (err: Error) => void }>>(new Map());
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  // Map of `${sceneName}:${uuid}` → sceneItemId (integer) for SetSceneItemEnabled
  const sceneItemMapRef = useRef<Map<string, number>>(new Map());
  const sceneItemRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneItemRemovedListenersRef = useRef(new Set<(event: SceneItemRemovedEvent) => void>());
  const inputListenersRef = useRef(new Set<(event: InputEvent) => void>());

  const [status, setStatus] = useState<ObsConnectionStatus>("closed");
  const [isAutoRetrying, setIsAutoRetrying] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sceneItems, setSceneItems] = useState<Record<string, SceneItem[]>>({});
  const [currentScene, setCurrentScene] = useState<string | null>(null);
  // When the current scene last changed, captured at the moment the change is
  // observed (event, switch, or initial fetch) so consumers don't need their
  // own change-detection effects to show an "updated at" time.
  const [sceneChangedAt, setSceneChangedAt] = useState<Date | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [togglingStream, setTogglingStream] = useState(false);
  const [sourceStats, setSourceStats] = useState<SourceStatsPayload | null>(null);
  const [obsStats, setObsStats] = useState<ObsStats | null>(null);

  // Scenes filtered to exclude names starting with - or _
  const filteredScenes = scenes.filter((s) => !/^[-_]/.test(s.sceneName));

  const send = useCallback((op: number, d: unknown) => {
    socketRef.current?.send(JSON.stringify({ op, d }));
  }, []);

  // Registers a pending reply before the frame goes out, and fails it after
  // REQUEST_TIMEOUT_MS (OBS busy, or the frame dropped on the way).
  const awaitReply = useCallback((requestId: string, label: string) => {
    return new Promise<unknown>((resolve, reject) => {
      pendingRef.current.set(requestId, { resolve, reject });
      setTimeout(() => {
        if (pendingRef.current.has(requestId)) {
          pendingRef.current.delete(requestId);
          reject(new Error(`Request "${label}" timed out`));
        }
      }, REQUEST_TIMEOUT_MS);
    });
  }, []);

  const request = useCallback(<T = unknown>(requestType: string, requestData?: unknown): Promise<T> => {
    const requestId = crypto.randomUUID();
    const reply = awaitReply(requestId, requestType);
    send(OP_REQUEST, { requestType, requestId, requestData });
    return reply as Promise<T>;
  }, [send, awaitReply]);

  // Many requests in one frame. The node's proxy drops a connection's frames
  // past 10 per 200 ms, so a request per scene sent at once loses some on a
  // bigger scene list. Results come back in request order, each with its
  // own status.
  const requestBatch = useCallback(
    (requests: { requestType: string; requestData?: unknown }[]): Promise<BatchResult[]> => {
      const requestId = crypto.randomUUID();
      const reply = awaitReply(requestId, `batch of ${requests.length}`);
      send(OP_REQUEST_BATCH, { requestId, requests });
      return reply as Promise<BatchResult[]>;
    },
    [send, awaitReply],
  );

  const fetchScenes = useCallback(async () => {
    const data = await request<{ scenes: Scene[]; currentProgramSceneName: string }>("GetSceneList");
    const sorted = data.scenes.slice().sort((a, b) => b.sceneIndex - a.sceneIndex);
    setScenes(sorted);
    setCurrentScene(data.currentProgramSceneName);
    setSceneChangedAt(new Date());

    // Build sceneItemId lookup for each scene so we can call SetSceneItemEnabled
    const map = new Map<string, number>();
    const itemsByScene: Record<string, SceneItem[]> = {};
    const results = sorted.length
      ? await requestBatch(
          sorted.map((scene) => ({ requestType: "GetSceneItemList", requestData: { sceneName: scene.sceneName } })),
        )
      : [];
    sorted.forEach((scene, i) => {
      const result = results[i];
      // A scene whose list failed is left out; toggling its items is a no-op.
      if (!result?.requestStatus.result) return;
      const { sceneItems } = result.responseData as { sceneItems: SceneItem[] };
      itemsByScene[scene.sceneName] = sceneItems;
      for (const item of sceneItems) {
        map.set(`${scene.sceneName}:${item.sourceUuid}`, item.sceneItemId);
      }
    });
    sceneItemMapRef.current = map;
    setSceneItems(itemsByScene);
  }, [request, requestBatch]);

  // Creates a scene if it doesn't already exist. Safe to call unconditionally —
  // a duplicate-name create is treated as a no-op rather than an error.
  const createScene = useCallback(async (sceneName: string) => {
    try {
      await request("CreateScene", { sceneName });
    } catch {
      // Most likely "already exists" — refetch below will confirm either way.
    }
    await fetchScenes();
  }, [request, fetchScenes]);

  const ensureSceneExists = useCallback(async (sceneName: string) => {
    const data = await request<{ scenes: Scene[] }>("GetSceneList");
    if (data.scenes.some((s) => s.sceneName === sceneName)) return;
    await createScene(sceneName);
  }, [request, createScene]);

  // Keeps sceneItems current when sources are added, removed, renamed or
  // repointed inside OBS itself, not only through this hook.
  const scheduleSceneItemRefresh = useCallback(() => {
    if (sceneItemRefreshRef.current) clearTimeout(sceneItemRefreshRef.current);
    sceneItemRefreshRef.current = setTimeout(() => {
      sceneItemRefreshRef.current = null;
      fetchScenes().catch(() => {});
    }, SCENE_ITEM_REFRESH_DELAY_MS);
  }, [fetchScenes]);

  // Subscribe to sources being removed from a scene. Returns the unsubscribe.
  const onSceneItemRemoved = useCallback((listener: (event: SceneItemRemovedEvent) => void) => {
    const listeners = sceneItemRemovedListenersRef.current;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Subscribe to sources being created, changed, renamed or deleted. Returns the unsubscribe.
  const onInputEvent = useCallback((listener: (event: InputEvent) => void) => {
    const listeners = inputListenersRef.current;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const sceneHasSource = useCallback((sceneName: string, sourceName: string) => {
    return (sceneItems[sceneName] ?? []).some((item) => item.sourceName === sourceName);
  }, [sceneItems]);

  const fetchStreamStatus = useCallback(async () => {
    const data = await request<{ outputActive: boolean }>("GetStreamStatus");
    setIsStreaming(data.outputActive);
  }, [request]);

  const switchScene = useCallback(async (sceneName: string) => {
    setSwitchingTo(sceneName);
    try {
      await request("SetCurrentProgramScene", { sceneName });
      setCurrentScene(sceneName);
      setSceneChangedAt(new Date());
    } finally {
      setSwitchingTo(null);
    }
  }, [request]);

  const toggleStream = useCallback(async () => {
    setTogglingStream(true);
    try {
      await request("ToggleStream");
      setIsStreaming((prev) => !prev);
    } finally {
      setTogglingStream(false);
    }
  }, [request]);

  const setSceneItemEnabled = useCallback(async (sceneName: string, sourceUuid: string, enabled: boolean) => {
    const sceneItemId = sceneItemMapRef.current.get(`${sceneName}:${sourceUuid}`);
    if (sceneItemId === undefined) return;
    await request("SetSceneItemEnabled", { sceneName, sceneItemId, sceneItemEnabled: enabled });
  }, [request]);

  const setSourceFilterEnabled = useCallback(async (sourceName: string, filterName: string, enabled: boolean) => {
    await request("SetSourceFilterEnabled", { sourceName, filterName, filterEnabled: enabled });
  }, [request]);

  // Creates a Media Source pulling `url` (an ingest output's SRT URL) and
  // drops it straight into `sceneName`, enabled. Refreshes the scene item map
  // afterward so the new item's toggle works in the Sources tree right away.
  //
  // - restart_on_activate: false — the IRL feed is a live pull, not a clip;
  //   restarting playback each time the source activates just adds a stall.
  // - reconnect_delay_sec: 2 — faster recovery when the ingest link drops.
  // After creation the source is stretched to fill the whole canvas so the
  // feed is fullscreen from the start (OBS drops a new media source at its
  // native pixel size otherwise, which can leave it invisible/off-frame).
  // Bounds a scene item to the base (canvas) resolution and lets OBS scale
  // the feed to fit inside, so a pulled feed fills the frame.
  const fillCanvas = useCallback(async (sceneName: string, sceneItemId: number) => {
    try {
      const video = await request<{ baseWidth: number; baseHeight: number }>("GetVideoSettings");
      await request("SetSceneItemTransform", {
        sceneName,
        sceneItemId,
        sceneItemTransform: {
          positionX: 0,
          positionY: 0,
          boundsType: "OBS_BOUNDS_SCALE_INNER",
          boundsWidth: video.baseWidth,
          boundsHeight: video.baseHeight,
        },
      });
    } catch {
      // Non-fatal: source is still added, just not auto-sized.
    }
  }, [request]);

  const addMediaSourceToScene = useCallback(async (sceneName: string, inputName: string, url: string) => {
    const created = await request<{ sceneItemId: number }>("CreateInput", {
      sceneName,
      inputName,
      inputKind: "ffmpeg_source",
      inputSettings: {
        is_local_file: false,
        input: url,
        restart_on_activate: false,
        reconnect_delay_sec: 2,
      },
      sceneItemEnabled: true,
    });
    await fillCanvas(sceneName, created.sceneItemId);
    await fetchScenes();
  }, [request, fillCanvas, fetchScenes]);

  // Puts a source that still exists (in another scene) into `sceneName`,
  // filling the canvas like addMediaSourceToScene.
  const addExistingSourceToScene = useCallback(async (sceneName: string, sourceName: string) => {
    const created = await request<{ sceneItemId: number }>("CreateSceneItem", {
      sceneName,
      sourceName,
      sceneItemEnabled: true,
    });
    await fillCanvas(sceneName, created.sceneItemId);
    await fetchScenes();
  }, [request, fillCanvas, fetchScenes]);

  // Changes some of an input's settings and keeps the rest. OBS sends
  // InputSettingsChanged, which refreshes sceneItems.
  const setInputSettings = useCallback(async (inputName: string, inputSettings: Record<string, unknown>) => {
    await request("SetInputSettings", { inputName, inputSettings, overlay: true });
  }, [request]);

  // Settings of several inputs in one batch frame (see requestBatch for why
  // not one request each). Inputs OBS couldn't read are left out.
  const getInputSettings = useCallback(async (inputNames: string[]) => {
    const settings: Record<string, Record<string, unknown>> = {};
    if (inputNames.length === 0) return settings;
    const results = await requestBatch(
      inputNames.map((inputName) => ({ requestType: "GetInputSettings", requestData: { inputName } })),
    );
    inputNames.forEach((inputName, i) => {
      const result = results[i];
      if (!result?.requestStatus.result) return;
      const data = result.responseData as { inputSettings?: Record<string, unknown> } | undefined;
      if (data?.inputSettings) settings[inputName] = data.inputSettings;
    });
    return settings;
  }, [requestBatch]);

  // Creates a Browser Source pointed at `url` (an overlay or alert widget
  // link, e.g. StreamElements) and drops it into `sceneName`, enabled. Sized
  // to a standard 1080p canvas unless `size` says otherwise — alert widgets
  // are transparent overlays, so that covers the frame without per-widget
  // dimensions. `reroute_audio` ("Control audio via OBS" in the UI) is on so
  // alert sound routes through OBS's mixer — required for the Source Clone in
  // addSourceCloneToScene to carry audio into other scenes at all.
  const addBrowserSourceToScene = useCallback(
    async (sceneName: string, inputName: string, url: string, size?: { width: number; height: number }) => {
      await request("CreateInput", {
        sceneName,
        inputName,
        inputKind: "browser_source",
        inputSettings: { url, width: size?.width ?? 1920, height: size?.height ?? 1080, reroute_audio: true },
        sceneItemEnabled: true,
      });
      await fetchScenes();
    },
    [request, fetchScenes],
  );

  // Creates a Source Clone (the exeldro obs-source-clone plugin, bundled with
  // every StreamWizard instance) in `sceneName` that mirrors `sourceName`'s
  // render output. Used to repeat an alert widget across scenes without
  // running a second browser process per scene — a real duplicate browser
  // source per scene would multiply CPU cost with every scene it's added to.
  const addSourceCloneToScene = useCallback(async (sceneName: string, inputName: string, sourceName: string) => {
    await request("CreateInput", {
      sceneName,
      inputName,
      inputKind: "source-clone",
      inputSettings: { clone: sourceName, clone_type: 0, audio: true },
      sceneItemEnabled: true,
    });
    await fetchScenes();
  }, [request, fetchScenes]);

  const connect = useCallback(() => {
    if (!getWsUrl || socketRef.current || connectingRef.current) return;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    connectingRef.current = true;
    setStatus("connecting");

    getWsUrl().then((wsUrl) => {
      connectingRef.current = false;
      if (socketRef.current) return;

      let everConnected = false;
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data as string);

        if (message.op === OP_HELLO) {
          const { rpcVersion, authentication } = message.d as {
            rpcVersion: number;
            authentication?: { challenge: string; salt: string };
          };
          if (authentication && password) {
            computeAuth(password, authentication.salt, authentication.challenge).then((authString) => {
              send(OP_IDENTIFY, { rpcVersion, authentication: authString, eventSubscriptions: EVENT_SUBSCRIPTIONS });
            });
          } else {
            send(OP_IDENTIFY, { rpcVersion, eventSubscriptions: EVENT_SUBSCRIPTIONS });
          }
        } else if (message.op === OP_IDENTIFIED) {
          everConnected = true;
          retryCountRef.current = 0;
          setIsAutoRetrying(false);
          setHasTimedOut(false);
          setStatus("open");
          fetchScenes().catch(() => {});
          fetchStreamStatus().catch(() => {});
          const pollStats = () => {
            request<ObsStats>("GetStats").then(setObsStats).catch(() => {});
          };
          pollStats();
          statsIntervalRef.current = setInterval(pollStats, 2000);
        } else if (message.op === OP_REQUEST_BATCH_RESPONSE) {
          const { requestId, results } = message.d as { requestId: string; results: BatchResult[] };
          const pending = pendingRef.current.get(requestId);
          if (pending) {
            pendingRef.current.delete(requestId);
            pending.resolve(results);
          }
        } else if (message.op === OP_REQUEST_RESPONSE) {
          const { requestId, requestStatus, responseData } = message.d as {
            requestId: string;
            requestStatus?: { result: boolean; code: number; comment?: string };
            responseData: unknown;
          };
          const pending = pendingRef.current.get(requestId);
          if (pending) {
            pendingRef.current.delete(requestId);
            if (requestStatus && !requestStatus.result) {
              pending.reject(new Error(requestStatus.comment || `Request failed (code ${requestStatus.code})`));
            } else {
              pending.resolve(responseData);
            }
          }
        } else if (message.op === OP_EVENT) {
          const { eventType, eventData } = message.d as {
            eventType: string;
            eventData: Record<string, unknown>;
          };
          if (eventType === "CurrentProgramSceneChanged") {
            setCurrentScene(eventData.sceneName as string);
            setSceneChangedAt(new Date());
          } else if (eventType === "StreamStateChanged") {
            setIsStreaming(eventData.outputActive as boolean);
          } else if (eventType === "SceneListChanged") {
            fetchScenes().catch(() => {});
          } else if (eventType === "SceneItemCreated" || eventType === "SceneItemRemoved") {
            const { sceneName, sourceName } = eventData;
            if (eventType === "SceneItemRemoved" && typeof sceneName === "string" && typeof sourceName === "string") {
              for (const listener of sceneItemRemovedListenersRef.current) listener({ sceneName, sourceName });
            }
            scheduleSceneItemRefresh();
          } else if (INPUT_REFRESH_EVENTS.has(eventType)) {
            const inputEvent = parseInputEvent(eventType, eventData);
            if (inputEvent) for (const listener of inputListenersRef.current) listener(inputEvent);
            scheduleSceneItemRefresh();
          } else if (eventType === "VendorEvent") {
            // vendorName lives inside eventData for VendorEvent, not at the top level
            const { vendorName, eventType: innerType, eventData: innerData } = eventData as {
              vendorName: string;
              eventType: string;
              eventData: SourceStatsPayload;
            };
            if (vendorName === "streamwizard-stats" && innerType === "SourceStats") {
              setSourceStats(innerData);
            }
          }
        }
      });

      socket.addEventListener("close", () => {
        if (statsIntervalRef.current) {
          clearInterval(statsIntervalRef.current);
          statsIntervalRef.current = null;
        }
        if (sceneItemRefreshRef.current) {
          clearTimeout(sceneItemRefreshRef.current);
          sceneItemRefreshRef.current = null;
        }
        socketRef.current = null;
        pendingRef.current.forEach((p) => p.reject(new Error("Connection closed")));
        pendingRef.current.clear();
        sceneItemMapRef.current.clear();
        setStatus("closed");
        setScenes([]);
        setSceneItems({});
        setCurrentScene(null);
        setSceneChangedAt(null);
        setIsStreaming(false);
        setSourceStats(null);
        setObsStats(null);

        // OBS wasn't ready yet — schedule a retry while we still have a URL.
        // Once OBS has connected at least once, close means the user stopped
        // the container intentionally, so we don't auto-retry.
        if (!everConnected) {
          retryCountRef.current += 1;
          if (retryCountRef.current < MAX_AUTO_RETRIES) {
            setIsAutoRetrying(true);
            retryTimerRef.current = setTimeout(() => {
              retryTimerRef.current = null;
              connect();
            }, RETRY_DELAY_MS);
          } else {
            // Exhausted the retry budget without OBS ever coming up. Surface a
            // distinct "timed out" state so the UI can offer a clear recovery
            // path instead of an indistinguishable "Disconnected".
            setIsAutoRetrying(false);
            setHasTimedOut(true);
          }
        }
      });

      socket.addEventListener("error", () => {
        socketRef.current?.close();
      });
    }).catch(() => {
      connectingRef.current = false;
      setStatus("closed");
    });
  }, [getWsUrl, password, send, fetchScenes, fetchStreamStatus, scheduleSceneItemRefresh]);

  const disconnect = useCallback(() => {
    socketRef.current?.close();
  }, []);

  // Manual reconnect after a timeout: the auto-retry loop reuses `connect`, so
  // we must reset the retry budget here or a timed-out socket would refuse to
  // try again (retryCount is already at MAX).
  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    setHasTimedOut(false);
    setIsAutoRetrying(false);
    connect();
  }, [connect]);

  useEffect(() => {
    retryCountRef.current = 0;
    setIsAutoRetrying(false);
    setHasTimedOut(false);
    if (getWsUrl) connect();
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      socketRef.current?.close();
    };
  }, [getWsUrl, connect]);

  return {
    status,
    isAutoRetrying,
    hasTimedOut,
    scenes,
    sceneItems,
    filteredScenes,
    currentScene,
    sceneChangedAt,
    isStreaming,
    switchingTo,
    togglingStream,
    sourceStats,
    obsStats,
    connect,
    reconnect,
    disconnect,
    switchScene,
    toggleStream,
    setSceneItemEnabled,
    setSourceFilterEnabled,
    addMediaSourceToScene,
    addExistingSourceToScene,
    getInputSettings,
    setInputSettings,
    addBrowserSourceToScene,
    addSourceCloneToScene,
    createScene,
    ensureSceneExists,
    sceneHasSource,
    onSceneItemRemoved,
    onInputEvent,
  };
}
