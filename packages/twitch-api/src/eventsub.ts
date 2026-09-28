import { TwitchApiBaseClient } from "./base-client";

export type TransportMethod = "webhook" | "websocket" | "conduit";

export interface Transport {
  method: TransportMethod;
  callback?: string;
  secret?: string;
  session_id?: string;
  conduit_id?: string;
  shard_id?: string;
  /** WebSocket transports only: when the session connected. */
  connected_at?: string;
  /** WebSocket transports only: when the session disconnected. */
  disconnected_at?: string;
}

export interface EventSubSubscription {
  id: string;
  status:
  | "enabled"
  | "webhook_callback_verification_pending"
  | "webhook_callback_verification_failed"
  | "notification_failures_exceeded"
  | "authorization_revoked"
  | "user_removed"
  | "version_removed";
  type: string;
  version: string;
  condition: Record<string, unknown>;
  created_at: string;
  transport: Transport;
  cost: number;
}

export interface CreateEventSubSubscriptionOptions {
  type: string;
  version: string;
  condition: Record<string, unknown>;
  transport: Transport;
}

export type ConduitShardStatus =
  | "enabled"
  | "webhook_callback_verification_pending"
  | "webhook_callback_verification_failed"
  | "notification_failures_exceeded"
  | "websocket_disconnected"
  | "websocket_failed_ping_pong"
  | "websocket_received_inbound_traffic"
  | "websocket_internal_error"
  | "websocket_network_timeout"
  | "websocket_network_error"
  | "websocket_failed_to_reconnect";

export interface ConduitShard {
  id: string;
  status: ConduitShardStatus;
  transport: Transport;
}

/** A shard Twitch refused to update. Update Conduit Shards still answers 202 when this happens. */
export interface ConduitShardError {
  id: string;
  message: string;
  code: string;
}

export interface UpdateShardsResult {
  data: ConduitShard[];
  errors: ConduitShardError[];
}

export interface SubscriptionsPageOptions {
  status?: EventSubSubscription["status"];
  type?: string;
  user_id?: string;
  after?: string;
}

/** One page of Get EventSub Subscriptions. The totals cover every page, not just this one. */
export interface SubscriptionsPage {
  data: EventSubSubscription[];
  total: number;
  total_cost: number;
  max_total_cost: number;
  pagination: { cursor?: string };
}

export interface CreateConduitOptions {
  shard_count: number;
}

export interface Conduit {
  id: string;
  shard_count: number;
  shards: ConduitShard[];
}

interface RequiredScopes {
  [key: string]: string[];
}

export class TwitchEventSubClient extends TwitchApiBaseClient {


  async createSubscription(options: CreateEventSubSubscriptionOptions, channelId: string): Promise<{ data: EventSubSubscription[] }> {
    const response = await this.appApi().post("/eventsub/subscriptions", options);
    return response.data;
  }

  async deleteSubscription(subscriptionId: string, channelId: string): Promise<void> {
    await this.appApi().delete(`/eventsub/subscriptions?id=${subscriptionId}`);
  }

  async getSubscriptions(channelId?: string): Promise<{ data: EventSubSubscription[] }> {
    const response = await this.appApi().get("/eventsub/subscriptions", {
      params: channelId ? { user_id: channelId } : undefined,
    });
    return response.data;
  }

  /** One page of subscriptions with Twitch's totals. Filter by at most one of status, type or user_id. */
  async getSubscriptionsPage(options: SubscriptionsPageOptions = {}): Promise<SubscriptionsPage> {
    const response = await this.appApi().get("/eventsub/subscriptions", { params: options });
    return response.data;
  }

  // Conduit-specific methods
  async createConduit(options: CreateConduitOptions): Promise<{ data: Conduit[] }> {
    const response = await this.appApi().post("/eventsub/conduits", options);
    return response.data;
  }

  async getConduits(): Promise<{ data: Conduit[] }> {
    const response = await this.appApi().get("/eventsub/conduits");
    return response.data;
  }

  async getConduitShards(
    conduitId: string,
    options: { status?: ConduitShardStatus; after?: string } = {},
  ): Promise<{ data: ConduitShard[]; pagination: { cursor?: string } }> {
    const response = await this.appApi().get("/eventsub/conduits/shards", {
      params: { conduit_id: conduitId, ...options },
    });
    return response.data;
  }

  /** Every shard of a conduit, following the cursor across pages. */
  async getAllConduitShards(conduitId: string, options: { status?: ConduitShardStatus } = {}): Promise<ConduitShard[]> {
    const shards: ConduitShard[] = [];
    let after: string | undefined;
    do {
      const page = await this.getConduitShards(conduitId, { ...options, after });
      shards.push(...page.data);
      after = page.pagination?.cursor || undefined;
    } while (after);
    return shards;
  }

  async getConduitWithShards(conduitId: string): Promise<Conduit | null> {
    try {
      const [conduitResponse, shardsResponse] = await Promise.all([this.getConduits(), this.getAllConduitShards(conduitId)]);

      const conduit = conduitResponse.data.find((c) => c.id === conduitId);
      if (!conduit) {
        return null;
      }

      return {
        ...conduit,
        shards: shardsResponse,
      };
    } catch (error) {
      console.error(`❌ Failed to get conduit ${conduitId} with shards:`, error);
      return null;
    }
  }

  /** Sets a conduit's shard count. Shards above the new count are removed along with their subscriptions' delivery. */
  async updateConduit(conduitId: string, shardCount: number): Promise<{ data: Conduit[] }> {
    const response = await this.appApi().patch("/eventsub/conduits", {
      id: conduitId,
      shard_count: shardCount,
    });
    return response.data;
  }

  /** @deprecated use updateConduit */
  async updateConduitShards(conduitId: string, shardCount: number): Promise<{ data: Conduit[] }> {
    return this.updateConduit(conduitId, shardCount);
  }

  /**
   * Points one shard at a transport. Twitch answers 202 even when the shard
   * was refused, so check `errors` for the shard id as well as the status.
   */
  async updateShardTransport(conduitId: string, shardId: string, transport: Transport): Promise<UpdateShardsResult> {
    const response = await this.appApi().patch("/eventsub/conduits/shards", {
      conduit_id: conduitId,
      shards: [
        {
          id: shardId,
          transport: transport,
        },
      ],
    });
    return { data: response.data?.data ?? [], errors: response.data?.errors ?? [] };
  }
}
