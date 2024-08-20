
type PlaceholderTypeKeys = {
  "channel.channel_points_custom_reward_redemption.add": string[]
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
};