import { supabase } from "@repo/supabase";
import { env } from "../lib/env";

export interface ObsCommand {
  request: string;
  params?: Record<string, unknown>;
}

export interface ObsCommandResult {
  ok: boolean;
  response?: unknown;
  error?: string;
}

interface ResolvedInstance {
  instanceId: string;
  apiUrl: string;
}

const INSTANCE_CACHE_TTL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;

const cache = new Map<string, { resolved: ResolvedInstance; at: number }>();

async function resolveInstance(userId: string): Promise<ResolvedInstance | null> {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.at < INSTANCE_CACHE_TTL_MS) return cached.resolved;

  const { data, error } = await supabase
    .from("obs_instances")
    .select("id, node_id, status, obs_nodes(api_url)")
    .eq("user_id", userId)
    .eq("status", "running")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`obs_instances lookup failed: ${error.message}`);
  const apiUrl = (data?.obs_nodes as { api_url?: string } | null)?.api_url;
  if (!data || !apiUrl) return null;

  const resolved = { instanceId: data.id, apiUrl: apiUrl.replace(/\/$/, "") };
  cache.set(userId, { resolved, at: Date.now() });
  return resolved;
}

export function invalidateInstanceCache(userId: string): void {
  cache.delete(userId);
}

async function post(resolved: ResolvedInstance, commands: ObsCommand[]): Promise<ObsCommandResult[]> {
  const res = await fetch(`${resolved.apiUrl}/internal/instances/${resolved.instanceId}/obs/command`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OBS_MANAGER_INTERNAL_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ commands }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`obs command HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { results: ObsCommandResult[] };
  return json.results;
}

/**
 * Runs a command batch against the user's running cloud OBS instance via the
 * node's internal endpoint. Throws when no running instance exists or the
 * node is unreachable; per-command OBS failures come back as ok:false.
 * A stale cache entry (instance moved/stopped since) gets one refresh+retry.
 */
export async function sendObsCommands(userId: string, commands: ObsCommand[]): Promise<ObsCommandResult[]> {
  const resolved = await resolveInstance(userId);
  if (!resolved) throw new Error("no running OBS instance");

  try {
    return await post(resolved, commands);
  } catch (err) {
    invalidateInstanceCache(userId);
    const fresh = await resolveInstance(userId);
    if (!fresh) throw new Error("no running OBS instance");
    if (fresh.instanceId === resolved.instanceId && fresh.apiUrl === resolved.apiUrl) throw err;
    return await post(fresh, commands);
  }
}

export async function setScene(userId: string, sceneUuid: string): Promise<ObsCommandResult> {
  const [result] = await sendObsCommands(userId, [{ request: "SetCurrentProgramScene", params: { sceneUuid } }]);
  return result ?? { ok: false, error: "empty result" };
}

export async function stopStream(userId: string): Promise<ObsCommandResult> {
  const [result] = await sendObsCommands(userId, [{ request: "StopStream" }]);
  return result ?? { ok: false, error: "empty result" };
}

interface SceneItem {
  sceneItemId: number;
  sourceUuid?: string;
  sourceName?: string;
}

/**
 * Resolve a source (by uuid, falling back to name) to its scene-item id in
 * the given scene, then toggle it. Two round-trips; the monitor caches the
 * resolved id and calls setSceneItemEnabledById on the hot path.
 */
export async function resolveSceneItemId(
  userId: string,
  sceneUuid: string,
  sourceUuid: string | null,
  sourceName: string | null,
): Promise<number | null> {
  const [result] = await sendObsCommands(userId, [{ request: "GetSceneItemList", params: { sceneUuid } }]);
  if (!result?.ok) return null;
  const items = ((result.response as { sceneItems?: SceneItem[] })?.sceneItems ?? []) as SceneItem[];
  const match =
    (sourceUuid ? items.find((i) => i.sourceUuid === sourceUuid) : undefined) ??
    (sourceName ? items.find((i) => i.sourceName === sourceName) : undefined);
  return match?.sceneItemId ?? null;
}

export async function setSceneItemEnabledById(
  userId: string,
  sceneUuid: string,
  sceneItemId: number,
  enabled: boolean,
): Promise<ObsCommandResult> {
  const [result] = await sendObsCommands(userId, [
    { request: "SetSceneItemEnabled", params: { sceneUuid, sceneItemId, sceneItemEnabled: enabled } },
  ]);
  return result ?? { ok: false, error: "empty result" };
}
