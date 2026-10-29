import type { UserNodeScope } from "@repo/node-token";
import { mintNodeTokenAction } from "@/actions/node-token";

// Client side of actions/node-token.ts. Node tokens last 60 seconds, so mint
// one right before each request (and each reconnect); never cache them.
export async function nodeToken(instanceId: string, scope: UserNodeScope): Promise<string> {
  const { data, error } = await mintNodeTokenAction(instanceId, scope);
  if (!data) throw new Error(error ?? "Couldn't authorize this request.");
  return data.token;
}

export async function nodeAuthHeader(instanceId: string, scope: UserNodeScope): Promise<string> {
  return `Bearer ${await nodeToken(instanceId, scope)}`;
}
