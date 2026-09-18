import { toast } from "sonner";
import type { DiscordActionResult } from "@/lib/discord/action";

/** Shows the right toast for an action result; returns true when it succeeded. */
export function toastResult(result: DiscordActionResult, success: string): boolean {
  if (result.error) {
    toast.error(result.error);
    return false;
  }
  if (result.warning) toast.warning(result.warning);
  else toast.success(success);
  return true;
}
