"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Edge } from "@xyflow/react";
import type { MonitorEnvelope } from "@/lib/monitor-ws";

const DOT_TRAVEL_MS = 600;

export type EdgeAnimationState = { trigger: number; isLast: boolean };
export type ActiveEdges = Map<string, EdgeAnimationState>;

export function useEdgeAnimation(
  events: MonitorEnvelope[],
  enabled: boolean,
  layoutEdges: Edge[] = []
) {
  const [activeEdges, setActiveEdges] = useState<ActiveEdges>(new Map());
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const lastProcessedRef = useRef(0);
  const layoutEdgesRef = useRef(layoutEdges);
  layoutEdgesRef.current = layoutEdges;

  const emitDot = useCallback((edgeId: string, delay: number, isLast: boolean) => {
    const timer = setTimeout(() => {
      setActiveEdges((prev) => {
        const next = new Map(prev);
        const existing = next.get(edgeId);
        next.set(edgeId, { trigger: (existing?.trigger ?? 0) + 1, isLast });
        return next;
      });
      timersRef.current.delete(timer);
    }, delay);
    timersRef.current.add(timer);
  }, []);

  useEffect(() => {
    if (!enabled || events.length === 0) return;

    for (const evt of events) {
      if (evt.ts <= lastProcessedRef.current) break;
      if (evt.kind !== "message") continue;

      const roomNodeId = `room-${evt.roomId}`;
      const roomEdgeId = `e-server-${roomNodeId}`;

      const connEdges = layoutEdgesRef.current.filter(
        (e) => e.source === roomNodeId && e.id !== roomEdgeId
      );
      const hasConnEdges = connEdges.length > 0;

      if (evt.role === "bot") {
        emitDot("e-bot-server", 0, false);
        emitDot(roomEdgeId, DOT_TRAVEL_MS, !hasConnEdges);
        for (const ce of connEdges) {
          emitDot(ce.id, DOT_TRAVEL_MS * 2, true);
        }
      } else if (evt.role === "publisher") {
        emitDot(roomEdgeId, 0, !hasConnEdges);
        for (const ce of connEdges) {
          emitDot(ce.id, DOT_TRAVEL_MS, true);
        }
      }
    }

    const first = events[0];
    if (first) {
      lastProcessedRef.current = first.ts;
    }
  }, [events, enabled, emitDot]);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current) {
        clearTimeout(timer);
      }
    };
  }, []);

  return activeEdges;
}
