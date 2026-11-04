import type { Context, Env } from "hono";
import { supabase } from "@repo/supabase";
import { userHasInstanceOnNode } from "@repo/supabase/queries/obs-nodes";
import { getStreamKeyForUser } from "@/modules/obs-nodes/instances/twitch-stream-key";
import { parseUuid } from "@/schemas/nodes-shared";

// Lives with the instance handlers: the node only asks for a stream key to
// boot one of its instances. The URL is still /users/:userId/stream-key.

// Returns { key: string | null, reason }. See StreamKeyReason: the node
// refuses to boot on "scope_missing" / "no_integration" and boots keyless on
// "error" (OBS then shows its "Enter Stream Key" screen).
export async function getStreamKey(c: Context<Env, "/users/:userId/stream-key">) {
  const nodeId = c.get("nodeId");
  const userId = parseUuid(c.req.param("userId"));
  if (!userId) return c.json({ error: "Invalid user id" }, 400);

  // The stream key is a live broadcast credential. Only hand it to a node that
  // actually hosts an instance for this user — otherwise a single compromised
  // node key could enumerate every user's Twitch stream key. That only holds
  // because a row needs the user's own launch token (POST /instances).
  if (!(await userHasInstanceOnNode(supabase, userId, nodeId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  return c.json(await getStreamKeyForUser(userId));
}
