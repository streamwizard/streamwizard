import type { HandlerRegistry } from "./eventHandler";
import { supabase } from "@repo/supabase";
import type {
  MinecraftPlayerDeathEvent,
  MinecraftPlayerJoinEvent,
  MinecraftPlayerQuitEvent,
} from "@/types/minecraft-incomming-websocket-messages";

/**
 * Register all Minecraft event handlers
 */
export const registerMinecraftHandlers = (handlers: HandlerRegistry) => {
  // Player joined the server
  handlers.registerMinecraftHandler<MinecraftPlayerJoinEvent>("player.join", async (event, context) => {
    // Add your player join logic here
    const { data, error } = await supabase
      .from("smp_players")
      .update({
        is_online: true,
      })
      .eq("minecraft_player_uuid", event.player_uuid);

    if (error) {
      console.error(error);
      return;
    }

  });

  // Player left the server
  handlers.registerMinecraftHandler<MinecraftPlayerQuitEvent>("player.quit", async (event, context) => {
    const { data, error } = await supabase
      .from("smp_players")
      .update({
        is_online: false,
      })
      .eq("minecraft_player_uuid", event.player_uuid);

    if (error) {
      console.error(error);
      return;
    }
  });

  // Player died
  handlers.registerMinecraftHandler<MinecraftPlayerDeathEvent>("player.death", async (event, context) => {
    console.log("Player died:", event);
    // Add your player death logic here
  });

  // Add more Minecraft event handlers as needed...
};
