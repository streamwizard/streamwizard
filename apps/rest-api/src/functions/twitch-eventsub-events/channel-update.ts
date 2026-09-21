import { reportError } from "@repo/sentry";
import { TwitchApi } from "@repo/twitch-api";
import { ChannelUpdateEvent } from "@repo/schemas";
import { supabase } from "@repo/supabase";
import { upsertBroadcasterLiveStatus } from "@repo/supabase/queries/live-status";
import { refreshGoLive } from "../../lib/discord-live";

export async function handleChannelUpdate(event: ChannelUpdateEvent, twitchApi: TwitchApi) {
  console.log(
    `[Twitch EventSub] Channel update for ${event.broadcaster_user_name}: ${event.title}`,
  );

  // Keep the go-live post in Discord current. Never throws, nothing waits on it.
  void refreshGoLive(event.broadcaster_user_id, { title: event.title, categoryName: event.category_name });

  try {
    await upsertBroadcasterLiveStatus(supabase, {
      broadcaster_id: event.broadcaster_user_id,
      broadcaster_name: event.broadcaster_user_name,
      title: event.title,
      category_id: event.category_id,
      category_name: event.category_name,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    reportError(error, "eventsub.channel-update", {
      broadcasterUserId: event.broadcaster_user_id,
    });
  }
}
