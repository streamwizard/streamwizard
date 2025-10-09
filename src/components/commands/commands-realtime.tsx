"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function CommandsRealtime({ channelId }: { channelId: string }) {
  const router = useRouter();
  useEffect(() => {
    const sub = supabase
      .channel("commands-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commands", filter: `channel_id=eq.${channelId}` },
        () => router.refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [channelId, router]);
  return null;
}


