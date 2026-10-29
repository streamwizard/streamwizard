import type { AdminNodeScope } from "@repo/node-token";
import { mintAdminNodeTokenAction } from "@/actions/nodes";

// Client side of mintAdminNodeTokenAction. Node tokens last 60 seconds, so
// mint one right before each ws-ticket request (and each reconnect).
export async function adminNodeToken(target: { instanceId: string } | { nodeId: string }, scope: AdminNodeScope): Promise<string> {
  const { data, error } = await mintAdminNodeTokenAction(target, scope);
  if (!data) throw new Error(error ?? "Couldn't authorize this request.");
  return data.token;
}
