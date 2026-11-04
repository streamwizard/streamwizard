import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { reportError } from "@repo/sentry";
import { getOverlaySceneBySubscriberToken, overlayItemBelongsToScene } from "@repo/supabase/queries/overlays/overlays";
import { selectWidgetInstanceStateByItem, updateWidgetInstanceState } from "@repo/supabase/queries/overlays/widgets";
// Was a second copy of the same allowlist. Shared now so the sandboxed-iframe
// origin can't be handled in one route and forgotten in the other.
import { corsHeaders, isPlausibleToken, isRateLimited } from "@/lib/widget-api";
import {
  MAX_WIDGET_STATE_BODY_BYTES,
  MAX_WIDGET_STATE_BYTES,
  widgetItemIdSchema,
  widgetStateBytes,
  widgetStateWriteSchema,
} from "@/schemas/widget-state";
import { readBearerToken } from "@repo/service-token/bearer";

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

function unauthorized(req: NextRequest) {
  return NextResponse.json({ error: "Not found or unauthorized" }, { status: 403, headers: corsHeaders(req) });
}

/**
 * The token checks every request passes before any lookup: the subscriber_token
 * format, then the per-token budget shared with the other widget API routes.
 */
function refuseToken(req: NextRequest, token: string): NextResponse | null {
  if (!isPlausibleToken(token)) return unauthorized(req);
  if (isRateLimited(token)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: corsHeaders(req) });
  }
  return null;
}

/** null when the item isn't in the token's scene; throws on a failed lookup. */
async function resolveInstance(token: string, itemId: string) {
  if (!isPlausibleToken(token)) return null;
  // Step 1: resolve subscriber_token → scene_id
  const { data: scene, error: sceneError } = await getOverlaySceneBySubscriberToken(supabaseAdmin, token);
  if (sceneError) throw sceneError;
  if (!scene) return null;

  // Step 2: confirm the item belongs to that scene
  if (!(await overlayItemBelongsToScene(supabaseAdmin, itemId, scene.id))) return null;

  // Step 3: fetch the widget instance row
  const { data: instance, error: instanceError } = await selectWidgetInstanceStateByItem(supabaseAdmin, itemId, scene.user_id);
  if (instanceError) throw instanceError;
  return instance ?? null;
}

// The subscriber token is a secret: header only, so it stays out of URLs,
// logs and request bodies.
function bearerToken(req: NextRequest): string | null {
  return readBearerToken(req.headers.get("authorization"));
}

export async function GET(req: NextRequest) {
  const token = bearerToken(req);
  const itemId = req.nextUrl.searchParams.get("itemId");

  if (!token || !itemId) {
    return NextResponse.json({ error: "Missing token or itemId" }, { status: 400, headers: corsHeaders(req) });
  }

  const parsedItemId = widgetItemIdSchema.safeParse(itemId);
  if (!parsedItemId.success) {
    return NextResponse.json({ error: "Invalid itemId" }, { status: 400, headers: corsHeaders(req) });
  }

  const refused = refuseToken(req, token);
  if (refused) return refused;

  let instance: Awaited<ReturnType<typeof resolveInstance>>;
  try {
    instance = await resolveInstance(token, parsedItemId.data);
  } catch (error) {
    reportError(error, "widget-state.read", { itemId: parsedItemId.data });
    return NextResponse.json({ error: "Failed to read state" }, { status: 500, headers: corsHeaders(req) });
  }
  if (!instance) return unauthorized(req);

  return NextResponse.json({ state: instance.widget_state ?? {} }, { headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_WIDGET_STATE_BODY_BYTES) {
    return NextResponse.json({ error: "Body too large" }, { status: 413, headers: corsHeaders(req) });
  }
  let body: unknown;
  try {
    // `null` is valid JSON with no fields to read; treat it as an empty body.
    body = JSON.parse(raw) ?? {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders(req) });
  }

  const { itemId, state } = body as Record<string, unknown>;
  const token = bearerToken(req);

  const parsed = widgetStateWriteSchema.safeParse({ itemId, state });
  if (typeof token !== "string" || !parsed.success) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400, headers: corsHeaders(req) });
  }
  if (widgetStateBytes(parsed.data.state) > MAX_WIDGET_STATE_BYTES) {
    return NextResponse.json(
      { error: `State exceeds ${MAX_WIDGET_STATE_BYTES} bytes` },
      { status: 413, headers: corsHeaders(req) }
    );
  }

  const refused = refuseToken(req, token);
  if (refused) return refused;

  try {
    const instance = await resolveInstance(token, parsed.data.itemId);
    if (!instance) return unauthorized(req);

    const { error } = await updateWidgetInstanceState(supabaseAdmin, instance.id, parsed.data.state);
    if (error) throw error;
  } catch (error) {
    reportError(error, "widget-state.write", { itemId: parsed.data.itemId });
    return NextResponse.json({ error: "Failed to save state" }, { status: 500, headers: corsHeaders(req) });
  }

  return NextResponse.json({ ok: true }, { headers: corsHeaders(req) });
}
