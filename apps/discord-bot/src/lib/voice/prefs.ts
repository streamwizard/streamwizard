import type { VoiceHub, VoiceOwnerPrefs } from "@repo/supabase/queries/discord-voice";
import { cleanChannelName } from "./template";

// What an owner's new channel starts as: what they saved for this hub, or the
// hub's defaults for anything they didn't. Pure, so it's tested without
// Discord or the database.

export interface StartingState {
  name: string;
  userLimit: number;
  locked: boolean;
  hidden: boolean;
  bannedUserIds: string[];
}

export function startingState(
  hub: Pick<VoiceHub, "default_user_limit">,
  prefs: Pick<VoiceOwnerPrefs, "name" | "user_limit" | "locked" | "hidden" | "banned_user_ids"> | null,
  { templateName, ownerId }: { templateName: string; ownerId: string },
): StartingState {
  return {
    name: (prefs?.name && cleanChannelName(prefs.name)) || templateName,
    userLimit: prefs?.user_limit ?? hub.default_user_limit,
    locked: prefs?.locked ?? false,
    hidden: prefs?.hidden ?? false,
    bannedUserIds: (prefs?.banned_user_ids ?? []).filter((id) => id !== ownerId),
  };
}
