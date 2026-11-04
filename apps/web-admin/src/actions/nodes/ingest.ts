"use server";

import { guidSchema } from "@repo/schemas/ids";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import { toActionError, toDataError, type DataResult } from "@/lib/actions/action-error";
import { FORBIDDEN, tryAdminContext } from "@/lib/auth/admin-context";
import { generateClaimToken, nodeInstallCommand } from "@/lib/nodes/claim-token";
import { ingestNodeCapacitySchema } from "@/schemas/ingest-node";
import { revokeIngestNodeWsSockets } from "@/lib/ws-revoke";
import {
  type IngestNode,
  type IngestNodeCapacity,
  listIngestNodes,
  createIngestNode,
  updateIngestNodeCapacity,
  deleteIngestNode,
  getIngestNodeById,
} from "@repo/supabase/queries/ingest/nodes";

const INGEST_NODES_PATH = "/ingest";
// Shorter than obs.ts's 30 minutes: the claim response for an ingest
// node includes the raw SUPABASE_SECRET_KEY (full service-role DB access),
// since ingest-control talks to Supabase directly rather than through
// rest-api. A tighter window shrinks the exposure if a claim command leaks.
const CLAIM_TOKEN_TTL_MS = 15 * 60 * 1000;
const NODE_NOT_FOUND = "Node not found.";

export async function listIngestNodesAction(): Promise<DataResult<IngestNode[]>> {
  const ctx = await tryAdminContext();
  if (!ctx) return { data: null, error: FORBIDDEN };
  try {
    return await listIngestNodes(ctx.adminClient);
  } catch (err) {
    return toDataError(err, "ingest-nodes.list", "Couldn't load the ingest nodes. Try again?");
  }
}

export async function getIngestNodeAction(id: string): Promise<DataResult<IngestNode>> {
  const ctx = await tryAdminContext();
  if (!ctx) return { data: null, error: FORBIDDEN };
  const nodeId = guidSchema.safeParse(id);
  if (!nodeId.success) return { data: null, error: NODE_NOT_FOUND };

  try {
    const node = await getIngestNodeById(ctx.adminClient, nodeId.data);
    return { data: node, error: node ? null : NODE_NOT_FOUND };
  } catch (err) {
    return toDataError(err, "ingest-nodes.get", "Couldn't load that node. Try again?", { nodeId: nodeId.data });
  }
}

export async function createIngestNodeAction(
  fields: IngestNodeCapacity,
): Promise<DataResult<{ node: IngestNode; rawToken: string; installCommand: string }>> {
  const ctx = await tryAdminContext();
  if (!ctx) return { data: null, error: FORBIDDEN };
  const parsed = ingestNodeCapacitySchema.safeParse(fields);
  if (!parsed.success) return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    const claim = generateClaimToken(CLAIM_TOKEN_TTL_MS);
    const { data, error } = await createIngestNode(ctx.adminClient, {
      ...parsed.data,
      claim_token_hash: claim.tokenHash,
      claim_token_expires_at: claim.expiresAt,
    });
    if (error || !data) return { data: null, error: error ?? "Couldn't create that node." };

    revalidatePath(INGEST_NODES_PATH);
    // No --tailscale-authkey needed here -- rest-api's /claim handler mints a
    // fresh, single-use, tag:ingest-node-scoped key via a Tailscale OAuth
    // client and hands it back in the claim response, so install.sh joins the
    // tailnet automatically with no admin-supplied secret at all.
    const installCommand = nodeInstallCommand("ingest-server", env.STREAMWIZARD_API_URL, claim.rawToken);
    return { data: { node: data, rawToken: claim.rawToken, installCommand }, error: null };
  } catch (err) {
    return toDataError(err, "ingest-nodes.create", "Couldn't create that node. Try again?");
  }
}

export async function updateIngestNodeAction(id: string, fields: IngestNodeCapacity): Promise<DataResult<IngestNode>> {
  const ctx = await tryAdminContext();
  if (!ctx) return { data: null, error: FORBIDDEN };
  const nodeId = guidSchema.safeParse(id);
  if (!nodeId.success) return { data: null, error: NODE_NOT_FOUND };
  const parsed = ingestNodeCapacitySchema.safeParse(fields);
  if (!parsed.success) return { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    const { data, error } = await updateIngestNodeCapacity(ctx.adminClient, nodeId.data, parsed.data);
    if (error) return { data: null, error };

    revalidatePath(INGEST_NODES_PATH);
    return { data, error: null };
  } catch (err) {
    return toDataError(err, "ingest-nodes.update", "Couldn't save that node. Try again?", { nodeId: nodeId.data });
  }
}

export async function deleteIngestNodeAction(id: string): Promise<{ error: string | null }> {
  const ctx = await tryAdminContext();
  if (!ctx) return { error: FORBIDDEN };
  const nodeId = guidSchema.safeParse(id);
  if (!nodeId.success) return { error: NODE_NOT_FOUND };

  try {
    const { error } = await deleteIngestNode(ctx.adminClient, nodeId.data);
    // Cut the node off now, not when its cached key runs out.
    if (!error) await revokeIngestNodeWsSockets(nodeId.data);
    revalidatePath(INGEST_NODES_PATH);
    return { error };
  } catch (err) {
    return toActionError(err, "ingest-nodes.delete", "Couldn't delete that node. Try again?", { nodeId: nodeId.data });
  }
}
