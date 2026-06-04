import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { Json } from "@repo/supabase";

const ALLOWED_ORIGINS = new Set([
  process.env.NEXT_PUBLIC_OVERLAY_URL,       // prod overlay URL
  process.env.NEXT_PUBLIC_BASE_URL,          // streamwizard dashboard (editor preview)
].filter(Boolean));

function corsHeaders(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "null";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

async function resolveInstance(token: string, itemId: string) {
  // Step 1: resolve subscriber_token → scene_id

  const { data: scene } = await supabaseAdmin
    .from("overlay_scenes")
    .select("id")
    .eq("subscriber_token", token)
    .maybeSingle();

  if (!scene) return null;

  // Step 2: confirm the item belongs to that scene
  const { data: item } = await supabaseAdmin
    .from("overlay_items")
    .select("id")
    .eq("id", itemId)
    .eq("scene_id", scene.id)
    .maybeSingle();

  if (!item) return null;

  // Step 3: fetch the widget instance row
  const { data: instance } = await supabaseAdmin
    .from("overlay_widget_instances")
    .select("id, widget_state")
    .eq("overlay_item_id", itemId)
    .maybeSingle();

  return instance ?? null;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const itemId = req.nextUrl.searchParams.get("itemId");

  if (!token || !itemId) {
    return NextResponse.json({ error: "Missing token or itemId" }, { status: 400, headers: corsHeaders(req) });
  }

  const instance = await resolveInstance(token, itemId);
  if (!instance) {
    return NextResponse.json({ error: "Not found or unauthorized" }, { status: 403, headers: corsHeaders(req) });
  }

  return NextResponse.json({ state: instance.widget_state ?? {} }, { headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders(req) });
  }

  const { token, itemId, state } = body as Record<string, unknown>;

  if (typeof token !== "string" || typeof itemId !== "string" || typeof state !== "object" || state === null || Array.isArray(state)) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400, headers: corsHeaders(req) });
  }

  const instance = await resolveInstance(token, itemId);
  if (!instance) {
    return NextResponse.json({ error: "Not found or unauthorized" }, { status: 403, headers: corsHeaders(req) });
  }

  const { error } = await supabaseAdmin
    .from("overlay_widget_instances")
    .update({ widget_state: state as Json, updated_at: new Date().toISOString() })
    .eq("id", instance.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders(req) });
  }

  return NextResponse.json({ ok: true }, { headers: corsHeaders(req) });
}
