import { TwitchApiBaseClient } from "./base-client";

export type HelixPollStatus = "ACTIVE" | "COMPLETED" | "TERMINATED" | "ARCHIVED" | "MODERATED" | "INVALID";

export interface HelixPollChoice {
  id: string;
  title: string;
  votes: number;
  channel_points_votes: number;
  bits_votes: number;
}

/** A poll from Get Polls. */
export interface HelixPoll {
  id: string;
  broadcaster_id: string;
  broadcaster_name: string;
  broadcaster_login: string;
  title: string;
  choices: HelixPollChoice[];
  bits_voting_enabled: boolean;
  bits_per_vote: number;
  channel_points_voting_enabled: boolean;
  channel_points_per_vote: number;
  status: HelixPollStatus;
  /** Seconds the poll runs for. */
  duration: number;
  started_at: string;
  /** Null while the poll is running. */
  ended_at: string | null;
}

export class TwitchPollsClient extends TwitchApiBaseClient {
  constructor(broadcaster_id: string | null = null) {
    super(broadcaster_id);
  }

  /**
   * The channel's newest poll, running or not, or null when it never ran one.
   * Needs the broadcaster's token with channel:read:polls.
   */
  async getLatestPoll(): Promise<HelixPoll | null> {
    const response = await this.clientApi().get("/polls", {
      params: { broadcaster_id: this.broadcaster_id, first: 1 },
    });
    return response.data?.data?.[0] ?? null;
  }
}
