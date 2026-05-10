export type MinecraftMessageType = "player.death" | "player.join" | "player.quit";

interface MinecraftBaseEvent<TEventType extends MinecraftMessageType, TExtraData> {
  player_uuid: string;
  player_name: string;
  timestamp: string;
  event_type: TEventType;
  extraData: TExtraData;
}

export type MinecraftPlayerJoinEvent = MinecraftBaseEvent<"player.join", Record<string, never>>;

export type MinecraftPlayerQuitEvent = MinecraftBaseEvent<"player.quit", Record<string, never>>;

export type MinecraftPlayerDeathEvent = MinecraftBaseEvent<
  "player.death",
  {
    message: string;
  }
>;