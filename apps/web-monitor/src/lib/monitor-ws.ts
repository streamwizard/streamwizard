"use client";

import { useEffect, useRef, useCallback, useState } from "react";

export type MonitorEnvelope = {
  ts: number;
  kind: "message" | "connect" | "disconnect" | "room";
  direction: "inbound" | "outbound" | "system";
  role: "publisher" | "subscriber" | "bot";
  roomId: string;
  eventType?: string;
  payload?: unknown;
  meta?: {
    subscriberCount?: number;
    hasPublisher?: boolean;
    durationMs?: number;
    sessionId?: string;
  };
};

export type ConnectionSnapshot = {
  connId: string;
  role: "publisher" | "subscriber";
  connectedAt: number;
  channels: string[];
};

export type RoomSnapshot = {
  roomId: string;
  hasPublisher: boolean;
  subscriberCount: number;
  sessionId: string;
  streamId: string | null;
  connections: ConnectionSnapshot[];
};

export type BotSnapshot = {
  connected: boolean;
  connId: string | null;
  connectedAt: number | null;
};

export type MonitorSnapshot = {
  ts: number;
  kind: "snapshot";
  rooms: RoomSnapshot[];
  totalConnections: number;
  bot: BotSnapshot;
};

export type MonitorMessage = MonitorEnvelope | MonitorSnapshot;

function isSnapshot(msg: MonitorMessage): msg is MonitorSnapshot {
  return msg.kind === "snapshot";
}

const MAX_EVENTS = 5000;
const RECONNECT_DELAY_MS = 3000;

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useMonitorWs(wsUrl: string | null, monitorSecret: string | null) {
  const [events, setEvents] = useState<MonitorEnvelope[]>([]);
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [eventsPerSec, setEventsPerSec] = useState(0);

  const pausedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventCountRef = useRef(0);

  const clearEvents = useCallback(() => setEvents([]), []);

  const setPaused = useCallback((paused: boolean) => {
    pausedRef.current = paused;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setEventsPerSec(eventCountRef.current);
      eventCountRef.current = 0;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!wsUrl || !monitorSecret) return;

    function connect() {
      setStatus("connecting");

      const url = `${wsUrl}/ws?role=monitor&token=${encodeURIComponent(monitorSecret!)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
      };

      ws.onmessage = (e) => {
        try {
          const msg: MonitorMessage = JSON.parse(e.data as string);

          if (isSnapshot(msg)) {
            setSnapshot(msg);
            return;
          }

          eventCountRef.current++;

          if (pausedRef.current) return;

          setEvents((prev) => {
            const next = [msg, ...prev];
            return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
          });
        } catch {
          // ignore malformed
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        wsRef.current = null;
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [wsUrl, monitorSecret]);

  return { events, snapshot, status, eventsPerSec, clearEvents, setPaused };
}
