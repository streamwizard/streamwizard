import { TwitchApiBaseClient } from "./base-client";

/** Get Creator Goals says "follower"; the channel.goal.* events say "follow". */
export type CreatorGoalType =
  | "follower"
  | "follow"
  | "subscription"
  | "subscription_count"
  | "new_subscription"
  | "new_subscription_count"
  | "new_bit"
  | "new_cheerer";

/** A goal from Get Creator Goals. Twitch only returns active ones. */
export interface CreatorGoal {
  id: string;
  broadcaster_id: string;
  broadcaster_name: string;
  broadcaster_login: string;
  type: CreatorGoalType;
  description: string;
  current_amount: number;
  target_amount: number;
  created_at: string;
}

export class TwitchGoalsClient extends TwitchApiBaseClient {
  constructor(broadcaster_id: string | null = null) {
    super(broadcaster_id);
  }

  /**
   * The channel's active goals. Needs the broadcaster's token with
   * channel:read:goals. Goals are created and edited on Twitch only; Helix has
   * no write endpoint for them.
   */
  async getCreatorGoals(): Promise<CreatorGoal[]> {
    const response = await this.clientApi().get("/goals", {
      params: { broadcaster_id: this.broadcaster_id },
    });
    return response.data?.data ?? [];
  }
}
