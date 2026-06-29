import { type Context } from "hono";
import { z } from "zod";
import { supabase } from "@repo/supabase";
import { getStreamKeyOwner, touchStreamKey, insertIngestSession } from "@repo/supabase/queries/ingest";
import { provisionObs, tenantOutputTarget, isObsPushMode } from "../obs/provisioner";

const bodySchema = z.object({
  protocol: z.enum(["rtmp", "srt", "srtla"]),
  stream_key: z.string().min(1),
  remote_ip: z.string().optional(),
});

/**
 * POST /internal/authorize
 *
 * Called by the media plane the moment a streamer connects. Validates the
 * stream key, opens an ingest session, provisions the streamer's OBS container,
 * and returns where the media plane should republish the passthrough feed.
 *
 * Responses:
 * - 200: { user_id, session_id, output_target }
 * - 400: { error } (bad body)
 * - 403: { error } (unknown / inactive key)
 * - 500: { error }
 */
export async function authorizeHandler(c: Context) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await c.req.json());
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const owner = await getStreamKeyOwner(supabase, body.stream_key);
  if (!owner) {
    return c.json({ error: "Invalid stream key" }, 403);
  }

  // Best-effort last-used bump; never blocks the connection.
  void touchStreamKey(supabase, body.stream_key);

  const { data: session, error } = await insertIngestSession(supabase, {
    user_id: owner.user_id,
    key_id: owner.key_id,
    protocol: body.protocol,
    remote_ip: body.remote_ip ?? null,
  });

  if (error || !session) {
    return c.json({ error: "Failed to open session" }, 500);
  }

  if (isObsPushMode()) {
    try {
      await provisionObs(owner.user_id);
    } catch (err) {
      console.error(`[authorize] OBS provisioning failed for ${owner.user_id}:`, err);
      return c.json({ error: "Failed to provision output" }, 500);
    }
  }

  return c.json({
    user_id: owner.user_id,
    session_id: session.id,
    output_target: tenantOutputTarget(owner.user_id),
  });
}
