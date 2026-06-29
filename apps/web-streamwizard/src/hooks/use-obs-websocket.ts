"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// obs-websocket v5 op codes
const OP_HELLO = 0;
const OP_IDENTIFY = 1;
const OP_IDENTIFIED = 2;
const OP_REQUEST = 6;
const OP_REQUEST_RESPONSE = 7;
const OP_EVENT = 5;

// General | Scenes | Outputs | Vendors
const EVENT_SUBSCRIPTIONS = (1 << 0) | (1 << 2) | (1 << 6) | (1 << 9);

export type ObsConnectionStatus = "closed" | "connecting" | "open";

export interface ObsLogEntry {
  id: string;
  timestamp: Date;
  direction: "in";
  op: number;
  opName: string;
  data: unknown;
}

const OP_NAMES: Record<number, string> = {
  0: "Hello",
  1: "Identify",
  2: "Identified",
  5: "Event",
  6: "Request",
  7: "RequestResponse",
};

const MAX_LOG_ENTRIES = 200;

// The source-profiler emits its SourceStats tree as a high-frequency VendorEvent.
// It's large and arrives many times a second, so it must never enter the bounded
// message log (see the message handler for why).
function isProfilerTelemetry(message: { op: number; d?: unknown }): boolean {
  if (message.op !== OP_EVENT) return false;
  const d = message.d as { eventType?: string; eventData?: { vendorName?: string } } | undefined;
  return d?.eventType === "VendorEvent" && d.eventData?.vendorName === "source-profiler";
}

export interface Scene {
  sceneName: string;
  sceneIndex: number;
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

export function useObsWebSocket({ getWsUrl, password }: UseObsWebSocketOptions) {
  const socketRef = useRef<WebSocket | null>(null);
  const connectingRef = useRef(false);
  const pendingRef = useRef<Map<string, (data: unknown) => void>>(new Map());
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Map of `${sceneName}:${uuid}` → sceneItemId (integer) for SetSceneItemEnabled
  const sceneItemMapRef = useRef<Map<string, number>>(new Map());

  const [status, setStatus] = useState<ObsConnectionStatus>("closed");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [currentScene, setCurrentScene] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [togglingStream, setTogglingStream] = useState(false);
  const [sourceStats, setSourceStats] = useState<SourceStatsPayload | null>(null);
  const [obsStats, setObsStats] = useState<ObsStats | null>(null);
  const [logEntries, setLogEntries] = useState<ObsLogEntry[]>([]);

  const appendLog = useCallback((op: number, data: unknown) => {
    const entry: ObsLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      direction: "in",
      op,
      opName: OP_NAMES[op] ?? `Op${op}`,
      data,
    };
    setLogEntries((prev) => {
      const next = [entry, ...prev];
      return next.length > MAX_LOG_ENTRIES ? next.slice(0, MAX_LOG_ENTRIES) : next;
    });
  }, []);

  // Scenes filtered to exclude names starting with - or _
  const filteredScenes = scenes.filter((s) => !/^[-_]/.test(s.sceneName));

  const send = useCallback((op: number, d: unknown) => {
    socketRef.current?.send(JSON.stringify({ op, d }));
  }, []);

  const request = useCallback(<T = unknown>(requestType: string, requestData?: unknown): Promise<T> => {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      pendingRef.current.set(requestId, (responseData) => resolve(responseData as T));
      send(OP_REQUEST, { requestType, requestId, requestData });
      setTimeout(() => {
        if (pendingRef.current.has(requestId)) {
          pendingRef.current.delete(requestId);
          reject(new Error(`Request "${requestType}" timed out`));
        }
      }, 10_000);
    });
  }, [send]);

  const fetchScenes = useCallback(async () => {
    const data = await request<{ scenes: Scene[]; currentProgramSceneName: string }>("GetSceneList");
    const sorted = data.scenes.slice().sort((a, b) => b.sceneIndex - a.sceneIndex);
    setScenes(sorted);
    setCurrentScene(data.currentProgramSceneName);

    // Build sceneItemId lookup for each scene so we can call SetSceneItemEnabled
    const map = new Map<string, number>();
    await Promise.all(
      sorted.map(async (scene) => {
        try {
          const items = await request<{ sceneItems: { sourceUuid: string; sceneItemId: number }[] }>(
            "GetSceneItemList",
            { sceneName: scene.sceneName }
          );
          for (const item of items.sceneItems) {
            map.set(`${scene.sceneName}:${item.sourceUuid}`, item.sceneItemId);
          }
        } catch {
          // non-fatal; toggle will be a no-op for items missing from the map
        }
      })
    );
    sceneItemMapRef.current = map;
  }, [request]);

  const fetchStreamStatus = useCallback(async () => {
    const data = await request<{ outputActive: boolean }>("GetStreamStatus");
    setIsStreaming(data.outputActive);
  }, [request]);

  const switchScene = useCallback(async (sceneName: string) => {
    setSwitchingTo(sceneName);
    try {
      await request("SetCurrentProgramScene", { sceneName });
      setCurrentScene(sceneName);
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

  const connect = useCallback(() => {
    if (!getWsUrl || socketRef.current || connectingRef.current) return;
    connectingRef.current = true;
    setStatus("connecting");

    getWsUrl().then((wsUrl) => {
      connectingRef.current = false;
      if (socketRef.current) return;

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data as string);
        // The source-profiler VendorEvent is high-frequency telemetry (a full
        // recursive source tree, many times a second) already consumed into
        // `sourceStats` for the profiler UI. Logging it would pin 200 copies of
        // a large payload in `logEntries` -- the dominant heap leak (V8 keeps
        // each payload's strings as ExternalStringData) -- and drown out every
        // real event in the debug log within seconds. Keep it out of the log.
        if (!isProfilerTelemetry(message)) {
          appendLog(message.op, message.d);
        }

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
          setStatus("open");
          fetchScenes().catch(() => {});
          fetchStreamStatus().catch(() => {});
          const pollStats = () => {
            request<ObsStats>("GetStats").then(setObsStats).catch(() => {});
          };
          pollStats();
          statsIntervalRef.current = setInterval(pollStats, 2000);
        } else if (message.op === OP_REQUEST_RESPONSE) {
          const { requestId, responseData } = message.d as { requestId: string; responseData: unknown };
          const resolve = pendingRef.current.get(requestId);
          if (resolve) {
            pendingRef.current.delete(requestId);
            resolve(responseData);
          }
        } else if (message.op === OP_EVENT) {
          const { eventType, eventData } = message.d as {
            eventType: string;
            eventData: Record<string, unknown>;
          };
          if (eventType === "CurrentProgramSceneChanged") {
            setCurrentScene(eventData.sceneName as string);
          } else if (eventType === "StreamStateChanged") {
            setIsStreaming(eventData.outputActive as boolean);
          } else if (eventType === "SceneListChanged") {
            fetchScenes().catch(() => {});
          } else if (eventType === "VendorEvent") {
            // vendorName lives inside eventData for VendorEvent, not at the top level
            const { vendorName, eventType: innerType, eventData: innerData } = eventData as {
              vendorName: string;
              eventType: string;
              eventData: SourceStatsPayload;
            };
            if (vendorName === "source-profiler" && innerType === "SourceStats") {
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
        socketRef.current = null;
        pendingRef.current.clear();
        sceneItemMapRef.current.clear();
        setStatus("closed");
        setScenes([]);
        setCurrentScene(null);
        setIsStreaming(false);
        setSourceStats(null);
        setObsStats(null);
      });

      socket.addEventListener("error", () => {
        socketRef.current?.close();
      });
    }).catch(() => {
      connectingRef.current = false;
      setStatus("closed");
    });
  }, [getWsUrl, password, send, fetchScenes, fetchStreamStatus, appendLog]);

  const disconnect = useCallback(() => {
    socketRef.current?.close();
  }, []);

  useEffect(() => {
    if (getWsUrl) connect();
    return () => { socketRef.current?.close(); };
  }, [getWsUrl, connect]);

  const clearLog = useCallback(() => setLogEntries([]), []);

  return {
    status,
    filteredScenes,
    currentScene,
    isStreaming,
    switchingTo,
    togglingStream,
    sourceStats,
    obsStats,
    logEntries,
    clearLog,
    connect,
    disconnect,
    switchScene,
    toggleStream,
    setSceneItemEnabled,
    setSourceFilterEnabled,
  };
}
