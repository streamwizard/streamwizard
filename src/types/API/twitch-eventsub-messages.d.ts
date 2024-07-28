type Subscription = {
  id: string;
  type: string;
  version: string;
  status: string;
  cost: number;
  condition: {
    broadcaster_user_id: string;
    reward_id?: string; // optional
  };
  transport: {
    method: string;
    callback: string;
  };
  created_at: string;
};

export type ChannelPointsCustomRewardRedemptionAdd = {
  id: string;
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
  user_id: string;
  user_login: string;
  user_name: string;
  user_input: string;
  status: string;
  reward: {
    id: string;
    title: string;
    cost: number;
    prompt: string;
  };
  redeemed_at: string;
};

export type EventSubPayload<T> = {
  subscription: Subscription;
  event: T
};