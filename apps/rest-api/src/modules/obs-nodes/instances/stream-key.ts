import { supabase } from "@repo/supabase";
import { userHasInstanceOnNode } from "@repo/supabase/queries/obs-nodes/instances";
import { getStreamKeyForUser, type StreamKeyLookup } from "@/modules/obs-nodes/instances/twitch-stream-key";

// Lives with the instance code: the node only asks for a stream key to boot
// one of its instances. The URL is still /users/:userId/stream-key.

// { key: string | null, reason }. See StreamKeyReason: the node refuses to
// boot on "scope_missing" / "no_integration" and boots keyless on "error"
// (OBS then shows its "Enter Stream Key" screen). null when this node hosts no
// instance for the user.
export async function getStreamKeyForNode(nodeId: string, userId: string): Promise<StreamKeyLookup | null> {
  // The stream key is a live broadcast credential. Only hand it to a node that
  // actually hosts an instance for this user — otherwise a single compromised
  // node key could enumerate every user's Twitch stream key. That only holds
  // because a row needs the user's own launch token (POST /instances).
  if (!(await userHasInstanceOnNode(supabase, userId, nodeId))) return null;
  return getStreamKeyForUser(userId);
}
