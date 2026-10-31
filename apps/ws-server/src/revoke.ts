import { supabase } from "@repo/supabase";
import { selectSceneOwnersByTokens } from "@repo/supabase/queries/overlays";
import { reportError } from "@repo/sentry";
import type { ConnectionData, ServerWebSocket } from "./types";

/**
 * Credential revocation for subscriber sockets.
 *
 * A token is only checked at upgrade. Resetting an overlay key or deleting a
 * scene changed the database, but sockets opened with the old subscriber_token
 * stayed in the room and kept receiving events for as long as they lived.
 * Every credentialed socket is tracked here by user, so it can be closed when
 * its credential stops being valid:
 *
 * - POST /internal/revoke (internal-http.ts), called by the apps right after
 *   a key reset, scene delete, ban or account deletion.
 * - A backstop sweep (index.ts) that re-checks every scene token once a
 *   minute, in one query, for whatever the explicit calls missed.
 */

export const REVOKED_CLOSE_CODE = 4001;

/** "scene": re-check overlay tokens; "session": dashboard JWTs; "all": both, no questions. */
export type RevokeScope = "scene" | "session" | "all";

const socketsByUser = new Map<string, Set<ServerWebSocket<ConnectionData>>>();

export function trackCredentialSocket(ws: ServerWebSocket<ConnectionData>): void {
  if (!ws.data.credential) return;
  const set = socketsByUser.get(ws.data.userId) ?? new Set();
  set.add(ws);
  socketsByUser.set(ws.data.userId, set);
}

export function untrackCredentialSocket(ws: ServerWebSocket<ConnectionData>): void {
  const set = socketsByUser.get(ws.data.userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) socketsByUser.delete(ws.data.userId);
}

function close(ws: ServerWebSocket<ConnectionData>): void {
  // The close handler in ws.ts does the room bookkeeping. Untrack now so a
  // second sweep before the close event lands doesn't count it twice.
  untrackCredentialSocket(ws);
  ws.close(REVOKED_CLOSE_CODE, "credential revoked");
}

const TOKEN_CHUNK = 100;

/**
 * Closes scene-token sockets whose token no longer exists or now belongs to
 * someone else. One query per 100 distinct tokens. Returns how many closed.
 */
async function closeStaleSceneSockets(sockets: ServerWebSocket<ConnectionData>[]): Promise<number> {
  const scene = sockets.filter((ws) => ws.data.credential?.kind === "scene");
  if (scene.length === 0) return 0;

  const tokens = [...new Set(scene.map((ws) => ws.data.credential!.token))];
  const owners = new Map<string, string>();
  for (let i = 0; i < tokens.length; i += TOKEN_CHUNK) {
    const { data, error } = await selectSceneOwnersByTokens(supabase, tokens.slice(i, i + TOKEN_CHUNK));
    // A failed lookup must not look like "every token is gone".
    if (error) throw error;
    for (const row of data ?? []) owners.set(row.subscriber_token, row.user_id);
  }

  let closed = 0;
  for (const ws of scene) {
    if (owners.get(ws.data.credential!.token) !== ws.data.userId) {
      close(ws);
      closed++;
    }
  }
  return closed;
}

export async function revokeUser(userId: string, scope: RevokeScope): Promise<number> {
  const sockets = [...(socketsByUser.get(userId) ?? [])];
  if (scope === "scene") return closeStaleSceneSockets(sockets);

  let closed = 0;
  for (const ws of sockets) {
    if (scope === "all" || ws.data.credential?.kind === "session") {
      close(ws);
      closed++;
    }
  }
  return closed;
}

/** Backstop: re-check every scene-token socket on the server. */
export async function sweepSceneCredentials(): Promise<number> {
  try {
    return await closeStaleSceneSockets([...socketsByUser.values()].flatMap((set) => [...set]));
  } catch (error) {
    reportError(error, "ws-server.revoke-sweep");
    return 0;
  }
}
