import type { Database } from "../types/supabase";
import type { UserIdentity } from "../queries/users/identity";

type TwitchLinkRow = Pick<
  Database["public"]["Tables"]["integrations_twitch"]["Row"],
  "twitch_user_id" | "twitch_username" | "profile_image_url" | "broadcaster_type"
>;

/** The public part of an integrations_twitch row, as UserIdentity and the admin user pages show it. */
export function toTwitchLink(row: TwitchLinkRow): NonNullable<UserIdentity["twitch"]> {
  return {
    userId: row.twitch_user_id,
    username: row.twitch_username,
    profileImageUrl: row.profile_image_url,
    broadcasterType: row.broadcaster_type,
  };
}
