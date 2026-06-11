import { createClient } from "@repo/supabase/next/server";
import { Film } from "lucide-react";
import { Database } from "@repo/supabase";
import TwitchClipCard from "@/components/cards/clip-card";
import { ClipScrollStrip } from "./ClipScrollStrip";

interface RecentClipsSectionProps {
  broadcasterId: string;
  compact?: boolean;
}

export async function RecentClipsSection({ broadcasterId, compact = false }: RecentClipsSectionProps) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("get_all_clips_with_folders")
    .eq("broadcaster_id", broadcasterId)
    .order("created_at_twitch", { ascending: false })
    .limit(10);

  if (error) console.error("[RecentClipsSection]", error.message);

  const clips = data ?? [];
  const label = "Recent clips";

  if (clips.length === 0) {
    return (
      <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.06] text-center">
        <Film className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No clips from this stream yet.</p>
        <p className="text-xs text-muted-foreground">Clips sync automatically when it ends.</p>
      </div>
    );
  }

  if (compact) {
    return (
      <ClipScrollStrip label={label} count={clips.length}>
        {clips.map((clip) => (
          <div key={clip.twitch_clip_id} className="w-72 shrink-0">
            <TwitchClipCard
              {...clip}
              folders={clip.folders as Database["public"]["Tables"]["clip_folders"]["Row"][]}
            />
          </div>
        ))}
      </ClipScrollStrip>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="text-xs text-muted-foreground">{clips.length} clips</span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {clips.map((clip) => (
          <TwitchClipCard
            key={clip.twitch_clip_id}
            {...clip}
            folders={clip.folders as Database["public"]["Tables"]["clip_folders"]["Row"][]}
          />
        ))}
      </div>
    </div>
  );
}
