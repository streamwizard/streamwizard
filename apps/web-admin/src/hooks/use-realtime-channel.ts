"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@repo/supabase/next/client";

export type RealtimeStatus = "off" | "connecting" | "subscribed" | "reconnecting";

type Client = ReturnType<typeof createBrowserClient>;
/** web-admin has no direct supabase-js dependency, so the channel type comes off the client. */
export type RealtimeChannel = ReturnType<Client["channel"]>;

/**
 * One Supabase Realtime channel for the life of the component. `build` adds
 * the listeners; the hook handles the rest: the admin's session token on the
 * socket (RLS decides what arrives, and without the token the channel
 * subscribes fine and stays silent), subscribe status, and teardown.
 * `onResubscribe` runs when the channel comes back after a drop, so the
 * caller can catch up on what it missed. `key` is the channel name; a null
 * key means no channel.
 */
export function useRealtimeChannel(
  key: string | null,
  build: (channel: RealtimeChannel) => RealtimeChannel,
  onResubscribe?: () => void,
): RealtimeStatus {
  const buildRef = useRef(build);
  const resubscribeRef = useRef(onResubscribe);
  const [status, setStatus] = useState<RealtimeStatus>(key ? "connecting" : "off");

  useEffect(() => {
    buildRef.current = build;
    resubscribeRef.current = onResubscribe;
  }, [build, onResubscribe]);

  useEffect(() => {
    if (!key) return;
    const supabase: Client = createBrowserClient();
    let cancelled = false;
    let everSubscribed = false;
    const channel = buildRef.current(supabase.channel(key));

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe((state) => {
        if (cancelled) return;
        if (state === "SUBSCRIBED") {
          if (everSubscribed) resubscribeRef.current?.();
          everSubscribed = true;
          setStatus("subscribed");
        } else if (state === "CLOSED" || state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
          setStatus(everSubscribed ? "reconnecting" : "connecting");
        }
      });
    })();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [key]);

  return key ? status : "off";
}
