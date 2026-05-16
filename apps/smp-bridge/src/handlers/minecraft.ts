import type { HandlerRegistry } from "./eventHandler";
import { supabase } from "@repo/supabase";
import { updateSmpPlayerOnlineStatus } from "@repo/supabase/queries/smp";
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
    try {
      await updateSmpPlayerOnlineStatus(supabase, event.player_uuid, true);
    } catch (error) {
      console.error(error);
    }
  });

  // Player left the server
  handlers.registerMinecraftHandler<MinecraftPlayerQuitEvent>("player.quit", async (event, context) => {
    try {
      await updateSmpPlayerOnlineStatus(supabase, event.player_uuid, false);
    } catch (error) {
      console.error(error);
    }
  });

  // Player died
  handlers.registerMinecraftHandler<MinecraftPlayerDeathEvent>("player.death", async (event, context) => {
    console.log("Player died:", event);
    // Add your player death logic here
  });

  // Add more Minecraft event handlers as needed...
};
