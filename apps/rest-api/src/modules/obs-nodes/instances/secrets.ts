import { randomBytes } from "crypto";
import type { Context, Env } from "hono";
import { supabase } from "@repo/supabase";
import { decryptToken, encryptToken } from "@repo/supabase/crypto";
import {
  getObsInstancePasswordFieldsForNode,
  setObsInstanceVncPasswordIfMissingForNode,
} from "@repo/supabase/queries/obs-nodes";

// OBS nodes never hold TOKEN_ENCRYPTION_KEY. rest-api decrypts an instance's
// OBS WebSocket and VNC passwords here and hands them only to the node that
// hosts the instance, so a compromised node can read its own instances'
// passwords and nothing else (no Twitch tokens, no node keys, no other
// node's instances).
//
// Never log the response body or the plaintext values in this file.

/** Same shape as the VNC passwords obs-instance-manager used to generate. */
export function generateVncPassword(): string {
  return randomBytes(18).toString("base64");
}

/** Encrypts a password into the { ciphertext, iv, tag } column shape. */
export function encryptPassword(plaintext: string): { ciphertext: string; iv: string; tag: string } {
  const { ciphertext, iv, authTag } = encryptToken(plaintext);
  return { ciphertext, iv, tag: authTag };
}

function decryptColumns(ciphertext: string | null, iv: string | null, tag: string | null): string | null {
  if (!ciphertext || !iv || !tag) return null;
  return decryptToken(ciphertext, iv, tag);
}

// Rows created before the VNC-password feature have no VNC password. Make one,
// store it only if the row still has none, and re-read on a lost race so two
// concurrent callers always end up with the same password.
async function ensureVncPassword(instanceId: string, nodeId: string): Promise<string | null> {
  const plaintext = generateVncPassword();
  const stored = await setObsInstanceVncPasswordIfMissingForNode(
    supabase,
    instanceId,
    nodeId,
    encryptPassword(plaintext),
  );
  if (stored) {
    console.log(`[obs-nodes] generated missing VNC password for instance ${instanceId}`);
    return plaintext;
  }
  const fields = await getObsInstancePasswordFieldsForNode(supabase, instanceId, nodeId);
  if (!fields) return null;
  return decryptColumns(fields.vnc_password_ciphertext, fields.vnc_password_iv, fields.vnc_password_tag);
}

/**
 * GET /api/obs-nodes/instances/:id/secrets
 * → { obs_ws_password: string | null, vnc_password: string }
 *
 * 404 for a missing instance and for another node's instance alike, so a node
 * can't tell whether an id exists elsewhere.
 */
export async function getInstanceSecrets(c: Context<Env, "/:id/secrets">) {
  c.header("Cache-Control", "no-store");
  const nodeId = c.get("nodeId");
  const id = c.req.param("id");

  const fields = await getObsInstancePasswordFieldsForNode(supabase, id, nodeId);
  if (!fields) return c.json({ error: "Instance not found" }, 404);

  try {
    const obsWsPassword = decryptColumns(
      fields.obs_ws_password_ciphertext,
      fields.obs_ws_password_iv,
      fields.obs_ws_password_tag,
    );

    let vncPassword = decryptColumns(fields.vnc_password_ciphertext, fields.vnc_password_iv, fields.vnc_password_tag);
    if (vncPassword === null) {
      if (fields.vnc_password_ciphertext) {
        // Ciphertext without iv/tag: the row is damaged, don't paper over it.
        throw new Error("VNC password columns are incomplete");
      }
      vncPassword = await ensureVncPassword(id, nodeId);
      // The row was deleted between the read and the write.
      if (vncPassword === null) return c.json({ error: "Instance not found" }, 404);
    }

    return c.json({ obs_ws_password: obsWsPassword, vnc_password: vncPassword });
  } catch (err) {
    // Message only: decrypt errors never contain the plaintext, but the
    // response body must never be logged.
    console.error(`[obs-nodes] instance secrets failed for ${id}: ${(err as Error).message}`);
    return c.json({ error: "Could not read instance secrets" }, 500);
  }
}
