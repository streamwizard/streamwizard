type PlaceholderTypeKeys = {
  "channel.channel_points_custom_reward_redemption.add": string[];
};

export function getPlaceholderKeys<T extends keyof PlaceholderTypeKeys>(type: string): string[] {
  return placeholderKeys[type as T];
}

const placeholderKeys = {
  "channel.channel_points_custom_reward_redemption.add": [
    "id",
    "broadcaster_user_id",
    "broadcaster_user_login",
    "broadcaster_user_name",
    "user_id",
    "user_login",
    "user_name",
    "user_input",
    "status",
    "reward.id",
    "reward.title",
    "reward.cost",
    "reward.prompt",
    "redeemed_at",
  ],
  "channel.ad_break.begin": [
    "duration_seconds",
    "started_at",
    "is_automatic",
    "broadcaster_user_id",
    "broadcaster_user_login",
    "broadcaster_user_name",
    "requester_user_id",
    "requester_user_login",
    "requester_user_name",
  ],

  get_ad_schedule: ["next_ad_at", "last_ad_at", "duration", "preroll_free_time", "snooze_count", "snooze_refresh_at"],

  custom_reward_update: [
    "broadcaster_name",
    "broadcaster_login",
    "broadcaster_id",
    "id",
    "image",
    "background_color",
    "is_enabled",
    "cost",
    "title",
    "prompt",
    "is_user_input_required",
    "max_per_stream_setting.is_enabled",
    "max_per_stream_setting.max_per_stream",
    "max_per_user_per_stream_setting.is_enabled",
    "max_per_user_per_stream_setting.max_per_user_per_stream",
    "global_cooldown_setting.is_enabled",
    "global_cooldown_setting.global_cooldown_seconds",
    "is_paused",
    "is_in_stock",
    "default_image.url_1x",
    "default_image.url_2x",
    "default_image.url_4x",
    "should_redemptions_skip_request_queue",
    "redemptions_redeemed_current_stream",
    "cooldown_expires_at",
  ],
};
