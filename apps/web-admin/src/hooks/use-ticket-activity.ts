"use client";

import { useEffect, useRef, useState } from "react";
import type { DiscordTicketActivityPayload } from "@repo/types";
import { supabase } from "@repo/supabase/next/client";

const EVENT = "streamwizard.discord_ticket_activity";

/**
 * Joins this admin's ws-server room (scoped by their Supabase JWT) and calls
 * `onEvent` for ticket activity the Discord bot pushes. Reconnects with
 * backoff. Returns whether the socket is currently open, so callers can fall
 * back to polling.
 */
export function useTicketActivity(
  wsUrl: string | null,
  onEvent: (payload: DiscordTicketActivityPayload) => void,
): boolean {
  const onEventRef = useRef(onEvent);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!wsUrl) return;
    let ws: WebSocket | null = null;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const connect = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token || cancelled) return;

      ws = new WebSocket(`${wsUrl}/ws?role=subscriber&token=${encodeURIComponent(token)}&channels=${EVENT}`);
      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string; payload: DiscordTicketActivityPayload };
          if (msg.type === EVENT) onEventRef.current(msg.payload);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onerror = () => ws?.close();
      ws.onclose = () => {
        setConnected(false);
        if (cancelled) return;
        // 1s, 2s, 4s … capped at 30s. A fresh session token is read on each try.
        retry = setTimeout(connect, Math.min(30_000, 1000 * 2 ** attempt++));
      };
    };

    void connect();
    return () => {
      cancelled = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, [wsUrl]);

  return connected;
}
