"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { MonitorEnvelope, MonitorMessage, MonitorSnapshot } from "@repo/types/monitor";
import { runMonitorSocket, type MonitorSocketStatus } from "@/lib/monitor/monitor-socket";

function isSnapshot(msg: MonitorMessage): msg is MonitorSnapshot {
  return msg.kind === "snapshot";
}

const MAX_EVENTS = 5000;

export type ConnectionStatus = MonitorSocketStatus;

export function useMonitorWs(wsUrl: string | null) {
  const [events, setEvents] = useState<MonitorEnvelope[]>([]);
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [eventsPerSec, setEventsPerSec] = useState(0);

  const pausedRef = useRef(false);
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
    if (!wsUrl) return;
    return runMonitorSocket<MonitorMessage>(wsUrl, {
      onStatus: setStatus,
      onMessage: (msg) => {
        if (isSnapshot(msg)) {
          setSnapshot(msg);
          return;
        }

        // Per-node bandwidth ticks arrive every ~10s per node — routing them
        // into the event buffer would flood the live feed. The /ingest live
        // panel consumes these via its own dedicated hook instead.
        if (msg.kind === "node_bandwidth") return;

        eventCountRef.current++;

        if (pausedRef.current) return;

        setEvents((prev) => {
          const next = [msg, ...prev];
          return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
        });
      },
    });
  }, [wsUrl]);

  return { events, snapshot, status, eventsPerSec, clearEvents, setPaused };
}
