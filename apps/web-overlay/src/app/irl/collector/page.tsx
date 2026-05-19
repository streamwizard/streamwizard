"use client";

import { useEffect, useRef, useState } from "react";
import { env } from "@repo/env/next";

type Status = "acquiring" | "connecting" | "connected" | "disconnected";

interface GeoPayload {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  accuracy: number;
  timestamp: number;
}




export default function IrlCollectorPage() {
  const [status, setStatus] = useState<Status>("acquiring");
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(1000);
  const watchIdRef = useRef<number | null>(null);
  const latestGeoRef = useRef<GeoPayload | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("disconnected");
      return;
    }

    function connect() {
      const wsUrl = env.NEXT_PUBLIC_WS_SERVER_URL ?? "ws://10.10.10.73:8000";
      setStatus("connecting");

      const ws = new WebSocket(
        `${wsUrl}/ws?role=publisher&token=${encodeURIComponent(token!)}`
      );
      wsRef.current = ws;

      ws.onopen = () => {
        retryDelay.current = 1000;
        setStatus("connected");
        if (latestGeoRef.current) {
          ws.send(JSON.stringify({ type: "geo", payload: latestGeoRef.current }));
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        const delay = retryDelay.current;
        retryDelay.current = Math.min(delay * 2, 30_000);
        retryRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const geo: GeoPayload = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude: pos.coords.altitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        latestGeoRef.current = geo;
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "geo", payload: geo }));
        }
      },
      (err) => console.warn("[geolocation]", err.message),
      { enableHighAccuracy: true }
    );

    connect();

    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      wsRef.current?.close();
    };
  }, []);

  const labels: Record<Status, string> = {
    acquiring: "Acquiring GPS…",
    connecting: "Connecting…",
    connected: "Connected ✓",
    disconnected: "Disconnected",
  };

  const colors: Record<Status, string> = {
    acquiring: "#aaa",
    connecting: "#aaa",
    connected: "#4ade80",
    disconnected: "#f87171",
  };

  return (
    <div
      style={{
        background: "transparent",
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 14,
          color: colors[status],
          letterSpacing: "0.05em",
        }}
      >
        {labels[status]}
      </span>
    </div>
  );
}
