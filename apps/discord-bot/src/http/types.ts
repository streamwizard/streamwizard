import type { Guild } from "discord.js";

/** Hono env for the internal API. `guild` is set by the guild middleware. */
export type AppEnv = {
  Variables: {
    guild: Guild;
  };
};
