type SubscriptionStatus =
  | "enabled"
  | "webhook_callback_verification_pending"
  | "webhook_callback_verification_failed"
  | "notification_failures_exceeded"
  | "authorization_revoked"
  | "moderator_removed"
  | "user_removed"
  | "version_removed"
  | "beta_maintenance"
  | "websocket_disconnected"
  | "websocket_failed_ping_pong"
  | "websocket_received_inbound_traffic"
  | "websocket_connection_unused"
  | "websocket_internal_error"
  | "websocket_network_timeout"
  | "websocket_network_error";


  


type Subscription = {
  id: string;
  status: SubscriptionStatus;
  type: string;
  version: string;
  condition: {
    broadcaster_user_id: string;
  };
  transport: {
    method: "webhook" | string; // Assuming other transport methods might exist
    callback: string | null;
  };
  created_at: string; // ISO 8601 timestamp format
  cost: number;
};

export type StreamOfflineObject = {
  broadcaster_user_id: string;
  broadcaster_user_login: string;
  broadcaster_user_name: string;
};

type StreamOfflineEvent = {
  subscription: Subscription;
  event: StreamOfflineObject;
};
