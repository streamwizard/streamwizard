import { TwitchApiBaseClient } from "./base-client";

export type HelixPredictionStatus = "ACTIVE" | "LOCKED" | "RESOLVED" | "CANCELED";

export interface HelixPredictionOutcome {
  id: string;
  title: string;
  /** How many viewers picked this outcome. */
  users: number;
  /** Channel points put on it. */
  channel_points: number;
  color: "BLUE" | "PINK";
}

/** A prediction from Get Predictions. */
export interface HelixPrediction {
  id: string;
  broadcaster_id: string;
  broadcaster_name: string;
  broadcaster_login: string;
  title: string;
  /** Null until the streamer picks the winner. */
  winning_outcome_id: string | null;
  outcomes: HelixPredictionOutcome[];
  /** Seconds viewers have to predict before it locks. */
  prediction_window: number;
  status: HelixPredictionStatus;
  created_at: string;
  /** Null until it is resolved or canceled. */
  ended_at: string | null;
  /** Null while viewers can still predict. */
  locked_at: string | null;
}

export class TwitchPredictionsClient extends TwitchApiBaseClient {
  constructor(broadcaster_id: string | null = null) {
    super(broadcaster_id);
  }

  /**
   * The channel's newest prediction, running or not, or null when it never
   * ran one. Needs the broadcaster's token with channel:read:predictions.
   */
  async getLatestPrediction(): Promise<HelixPrediction | null> {
    const response = await this.clientApi().get("/predictions", {
      params: { broadcaster_id: this.broadcaster_id, first: 1 },
    });
    return response.data?.data?.[0] ?? null;
  }
}
