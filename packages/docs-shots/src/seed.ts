import { localSupabase, type LocalSupabase } from "./auth";
import { BROADCASTER, CLIP_TITLES, GAMES, VIEWERS } from "./fixtures/viewers";

/**
 * Every row this harness writes lives under one id prefix, so teardown deletes
 * exactly what it created and can never touch anything real. Same trick as
 * scripts/cms-mock/seed.ts.
 */
const PREFIX = "0000d0c5";

/** The local smoke account every authenticated shot signs in as. */
export const SMOKE_USER_ID =
  process.env.SHOTS_USER_ID ?? "bfd69dff-d4fa-4d0b-b065-0172429c771f";

const STREAM_ID = `${PREFIX}-57ea-4000-8000-000000000001`;

/** Matches SHOT_VOD in the VOD harness route, so the timeline finds its events. */
const SHOT_VIDEO_ID = "2451234571";

function shotId(kind: number, n: number): string {
  return `${PREFIX}-${kind.toString(16).padStart(4, "0")}-4000-8000-${n
    .toString(16)
    .padStart(12, "0")}`;
}

async function rest(
  supabase: LocalSupabase,
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  prefer = "return=minimal",
): Promise<void> {
  const res = await fetch(`${supabase.url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: supabase.serviceKey,
      Authorization: `Bearer ${supabase.serviceKey}`,
      "Content-Type": "application/json",
      Prefer: prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  }
}

/** Stream start, fixed so durations and offsets never move between runs. */
const STREAM_START = new Date("2026-08-14T17:00:00Z");
const STREAM_END = new Date("2026-08-14T21:12:00Z");

function clipRows(userId: string) {
  return CLIP_TITLES.map((title, i) => {
    const game = GAMES[i % GAMES.length]!;
    const created = new Date(STREAM_START.getTime() + (i + 1) * 17 * 60_000);
    return {
      id: shotId(1, i),
      twitch_clip_id: `ShotClip${i}`,
      title,
      creator_name: VIEWERS[i % VIEWERS.length],
      creator_id: `9100000${i}`,
      broadcaster_name: BROADCASTER.display,
      broadcaster_id: BROADCASTER.id,
      game_name: game.name,
      game_id: game.id,
      url: `https://clips.twitch.tv/ShotClip${i}`,
      embed_url: `https://clips.twitch.tv/embed?clip=ShotClip${i}`,
      // Intercepted by the harness and answered with a generated image; the
      // fixture clips do not exist on Twitch.
      thumbnail_url: `https://static-cdn.jtvnw.net/shot-previews/ShotClip${i}-480x272.jpg`,
      view_count: 1200 - i * 73,
      duration: 30 - (i % 4) * 5,
      language: "en",
      is_featured: i === 0,
      vod_offset: (i + 1) * 1020,
      created_at_twitch: created.toISOString(),
      user_id: userId,
    };
  });
}

function folderRows(userId: string) {
  return [
    { id: shotId(2, 1), name: "Best of", href: "best-of", user_id: userId, parent_folder_id: null },
    { id: shotId(2, 2), name: "Clips to post", href: "clips-to-post", user_id: userId, parent_folder_id: null },
    { id: shotId(2, 3), name: "Shorts", href: "shorts", user_id: userId, parent_folder_id: shotId(2, 2) },
  ];
}

/** A stream with a believable viewer curve, for the dashboard's chart. */
function viewerRows() {
  const points = 50;
  return Array.from({ length: points }, (_, i) => {
    const offset = i * 300;
    const ramp = Math.round(140 + i * 9);
    const dip = i > 32 ? Math.round((i - 32) * 11) : 0;
    return {
      id: shotId(4, i),
      stream_id: STREAM_ID,
      broadcaster_id: BROADCASTER.id,
      viewer_count: Math.max(60, ramp - dip),
      game_id: GAMES[i < 18 ? 0 : 1]!.id,
      game_name: GAMES[i < 18 ? 0 : 1]!.name,
      title: "late night rust, no plan",
      offset_seconds: offset,
      recorded_at: new Date(STREAM_START.getTime() + offset * 1000).toISOString(),
    };
  });
}

/**
 * A believable spread of events across the stream, so the VOD timeline has
 * markers and the dashboard's activity feed has rows.
 */
function eventRows() {
  const spec: Array<[string, number, Record<string, unknown>]> = [
    ["channel.follow", 420, { user_name: VIEWERS[0] }],
    ["channel.cheer", 1_860, { user_name: VIEWERS[2], bits: 500 }],
    ["channel.subscribe", 3_120, { user_name: VIEWERS[1], tier: "1000" }],
    ["channel.follow", 4_500, { user_name: VIEWERS[3] }],
    ["channel.raid", 6_240, { from_broadcaster_user_name: VIEWERS[4], viewers: 62 }],
    ["channel.subscription.message", 7_980, { user_name: VIEWERS[5], tier: "1000", months: 7 }],
    ["channel.follow", 9_300, { user_name: VIEWERS[6] }],
    ["channel.cheer", 10_920, { user_name: VIEWERS[7], bits: 1_200 }],
    ["channel.subscription.gift", 12_600, { user_name: VIEWERS[8], total: 5, tier: "1000" }],
    ["channel.follow", 14_040, { user_name: VIEWERS[9] }],
  ];
  return spec.map(([event_type, offset_seconds, event_data], i) => ({
    id: shotId(8, i),
    stream_id: STREAM_ID,
    broadcaster_id: BROADCASTER.id,
    event_type,
    offset_seconds,
    event_data,
    provider: "twitch",
    status: "received",
  }));
}

/** The overlay the editor screenshots open, and the list screenshot shows. */
export const SHOT_SCENE_ID = `${PREFIX}-0009-4000-8000-000000000001`;

function sceneRow(userId: string) {
  return {
    id: SHOT_SCENE_ID,
    user_id: userId,
    name: "Starting soon",
    slug: "shot-starting-soon",
    // Short and obviously a placeholder: a realistic token is a secret, and
    // the leak scanner fails any shot that shows something token-shaped.
    subscriber_token: "shot-room",
    width: 1920,
    height: 1080,
    is_active: true,
    is_favourite: false,
    render_mode: "obs",
  };
}

/** A layout with enough on it that the layers panel is worth photographing. */
function sceneItemRows() {
  const base = {
    scene_id: SHOT_SCENE_ID,
    anchor_x: "left",
    anchor_y: "top",
    crop_top: 0,
    crop_right: 0,
    crop_bottom: 0,
    crop_left: 0,
    rotation: 0,
    flip_h: false,
    flip_v: false,
    opacity: 1,
    is_visible: true,
    is_locked: false,
  };
  return [
    {
      ...base,
      id: shotId(10, 1),
      type: "text_widget",
      label: "Title",
      x: 160,
      y: 300,
      w: 1120,
      h: 180,
      design_w: 1120,
      design_h: 180,
      z_index: 3,
      config: {
        text: "starting soon",
        fontSize: 96,
        color: "#ffffff",
        align: "left",
        fontWeight: 700,
        fontFamily: "Inter",
        textShadow: true,
        outlineWidth: 2,
        outlineColor: "#000000",
        backgroundColor: "#000000",
        backgroundOpacity: 0,
        backgroundRounding: 0,
        scroll: false,
        scrollSpeed: 80,
      },
    },
    {
      ...base,
      id: shotId(10, 2),
      type: "timer_widget",
      label: "Countdown",
      x: 160,
      y: 520,
      w: 520,
      h: 140,
      design_w: 520,
      design_h: 140,
      z_index: 2,
      config: {
        mode: "duration",
        durationSeconds: 600,
        finishedText: "We're live!",
        fontSize: 72,
        color: "#9e7aff",
        align: "left",
        fontWeight: 600,
        fontFamily: "Inter",
      },
    },
    {
      ...base,
      id: shotId(10, 3),
      type: "shape_widget",
      label: "Backdrop",
      x: 120,
      y: 240,
      w: 1240,
      h: 520,
      design_w: 1240,
      design_h: 520,
      z_index: 1,
      is_locked: true,
      config: {
        shape: "rectangle",
        fillColor: "#140f24",
        fillOpacity: 0.85,
        strokeColor: "#9e7aff",
        strokeWidth: 2,
        rounding: 6,
        lineWidth: 8,
        fillType: "solid",
        gradientColor: "#00d4ff",
        gradientAngle: 90,
        strokeType: "solid",
        strokeGradientColor: "#00d4ff",
        strokeGradientAngle: 90,
        roundedEnds: false,
      },
    },
  ];
}

/** The custom widget the code-editor screenshot opens. */
export const SHOT_WIDGET_ID = `${PREFIX}-0011-4000-8000-000000000001`;

function widgetRow(userId: string) {
  return {
    id: SHOT_WIDGET_ID,
    user_id: userId,
    name: "Follower counter",
    description: "A counter that ticks up on every follow.",
    tags: ["followers", "counter"],
    html: '<div class="count"><span id="n">0</span> followers</div>',
    extra_css: ".count { font: 700 48px Inter, sans-serif; color: #fff; }",
    // The real widget API: addEventListener('onWidgetLoad' | 'onEventReceived')
    // and StreamWizard.state.get()/.set({...}). Checked against
    // apps/docs/widgets/api/globals.mdx, because this code is published in a
    // screenshot and someone will copy it.
    js: [
      "// Runs once when the overlay loads.",
      "addEventListener('onWidgetLoad', async () => {",
      "  const saved = await StreamWizard.state.get().catch(() => null);",
      "  render(saved?.count ?? 0);",
      "});",
      "",
      "// Every follow bumps the number, then saves it for next time.",
      "addEventListener('onEventReceived', async (e) => {",
      "  const { listener } = e.detail;",
      "  if (listener !== 'channel.follow') return;",
      "",
      "  const saved = await StreamWizard.state.get().catch(() => null);",
      "  const count = (saved?.count ?? 0) + 1;",
      "  await StreamWizard.state.set({ count });",
      "  render(count);",
      "});",
      "",
      "function render(value) {",
      "  document.getElementById('n').textContent = value;",
      "}",
    ].join("\\n"),
    fields: [],
  };
}

export interface SeedHandle {
  teardown: () => Promise<void>;
}

/**
 * Put believable rows in front of the camera, then take them away again.
 * Only ever writes to a localhost Supabase; localSupabase() refuses anything
 * else.
 */
export async function seedShotData(opts: { onboarding?: boolean } = {}): Promise<SeedHandle> {
  const supabase = localSupabase();
  const userId = SMOKE_USER_ID;

  // user_metadata.sub is the Twitch user id the OAuth sign-in writes, and it
  // is what the dashboard reads to find the broadcaster: not
  // integrations_twitch. A password smoke account has never been through
  // Twitch, so nothing fills it in.
  //
  // Without a display name the dashboard's user menu throws; without the
  // preference below the onboarding wizard covers every page.
  await fetch(`${supabase.url}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      apikey: supabase.serviceKey,
      Authorization: `Bearer ${supabase.serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_metadata: {
        sub: BROADCASTER.id,
        full_name: BROADCASTER.display,
        preferred_username: BROADCASTER.name,
      },
    }),
  });

  await rest(
    supabase,
    "POST",
    "user_preferences?on_conflict=user_id",
    [
      {
        user_id: userId,
        // Flipped deliberately when shooting the onboarding wizard itself.
        onboarding_completed: opts.onboarding !== true,
        sync_clips_on_end: true,
        show_stream_stats: true,
        // Pinned: the meme setting swaps copy and animation, so leaving it to
        // chance means two runs can produce different words.
        memes_enabled: false,
      },
    ],
    "resolution=merge-duplicates",
  );

  const widget = widgetRow(userId);
  const scene = sceneRow(userId);
  const sceneItems = sceneItemRows();
  const events = eventRows();
  const clips = clipRows(userId);
  const folders = folderRows(userId);
  const viewers = viewerRows();
  const liveStatusId = shotId(3, 1);

  /**
   * Remove this harness's own rows. Runs before the insert as well as after,
   * so a run that died halfway through does not block the next one on a
   * unique constraint.
   */
  const removeShotRows = async () => {
    const byIds = (table: string, ids: string[]) =>
      ids.length ? rest(supabase, "DELETE", `${table}?id=in.(${ids.join(",")})`) : undefined;

    await rest(
      supabase,
      "DELETE",
      `clip_folder_junction?folder_id=in.(${folders.map((f) => f.id).join(",")})`,
    );
    await byIds("clips", clips.map((c) => c.id));
    // Subfolders reference their parent, so delete the deepest first.
    await byIds("clip_folders", [...folders].reverse().map((f) => f.id));
    await byIds("overlay_items", sceneItems.map((i) => i.id));
    await byIds("overlay_widgets", [SHOT_WIDGET_ID]);
    await byIds("overlay_scenes", [SHOT_SCENE_ID]);
    await byIds("stream_events", events.map((e) => e.id));
    await byIds("stream_viewer_counts", viewers.map((v) => v.id));
    await byIds("vods", [shotId(7, 1)]);
    await byIds("broadcaster_live_status", [liveStatusId]);
    await rest(supabase, "DELETE", `integrations_twitch?id=eq.${shotId(5, 1)}`);
    await rest(supabase, "DELETE", `integrations?id=eq.${shotId(6, 1)}`);
  };

  await removeShotRows();

  // Viewer counts and live status are foreign-keyed to a Twitch integration,
  // which is itself foreign-keyed to an integrations row, and the smoke
  // account has neither. No tokens on either: nothing here calls Twitch.
  await rest(
    supabase,
    "POST",
    "integrations?on_conflict=user_id",
    [{ id: shotId(6, 1), user_id: userId }],
    "resolution=merge-duplicates",
  );

  await rest(
    supabase,
    "POST",
    "integrations_twitch?on_conflict=user_id",
    [
      {
        id: shotId(5, 1),
        user_id: userId,
        twitch_user_id: BROADCASTER.id,
        twitch_username: BROADCASTER.display,
        broadcaster_type: "affiliate",
      },
    ],
    "resolution=merge-duplicates",
  );

  // Viewer samples hang off a vods row keyed by stream_id, and the VOD page
  // looks its events up through the same row by video_id.
  await rest(supabase, "POST", "vods", [
    {
      id: shotId(7, 1),
      broadcaster_id: BROADCASTER.id,
      stream_id: STREAM_ID,
      video_id: SHOT_VIDEO_ID,
      started_at: STREAM_START.toISOString(),
    },
  ]);

  await rest(supabase, "POST", "overlay_widgets", [widget]);
  await rest(supabase, "POST", "overlay_scenes", [scene]);
  await rest(supabase, "POST", "overlay_items", sceneItems);
  await rest(supabase, "POST", "stream_events", events);

  await rest(supabase, "POST", "clips", clips);
  await rest(supabase, "POST", "clip_folders", folders);
  await rest(supabase, "POST", "stream_viewer_counts", viewers);
  await rest(supabase, "POST", "broadcaster_live_status", [
    {
      id: liveStatusId,
      broadcaster_id: BROADCASTER.id,
      broadcaster_name: BROADCASTER.display,
      stream_id: STREAM_ID,
      is_live: false,
      title: "late night rust, no plan",
      category_id: GAMES[1]!.id,
      category_name: GAMES[1]!.name,
      stream_started_at: STREAM_START.toISOString(),
      stream_ended_at: STREAM_END.toISOString(),
    },
  ]);

  return {
    async teardown() {
      await removeShotRows();
      if (opts.onboarding) {
        await rest(
          supabase,
          "POST",
          "user_preferences?on_conflict=user_id",
          [{ user_id: userId, onboarding_completed: true }],
          "resolution=merge-duplicates",
        );
      }
    },
  };
}
