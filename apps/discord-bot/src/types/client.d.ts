import type { Collection } from "discord.js";
import type { AnyCommand } from "./discord";

declare module "discord.js" {
  interface Client {
    commands: Collection<string, AnyCommand>;
  }
}
