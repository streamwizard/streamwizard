// One place for every custom event and the properties it carries. Add here
// first, then capture. No SDK imports: the browser helper (events.ts) and the
// server helper (server.ts) both type against this, and neither should pull in
// the other's SDK.
//
// PostHog enforces no schema, so a misspelled property silently becomes a new
// one and the chart built on the old name goes flat. Typing them here is the
// only check there is.

type NoProps = Record<string, never>;

// Where an overlay page is open: an OBS browser source, a plain browser tab,
// or framed inside another page.
export type OverlayClient = "obs" | "browser" | "embed";

interface Preferences {
  memes_enabled?: boolean;
  sync_clips_on_end?: boolean;
  show_stream_stats?: boolean;
  discord_live_notifications?: boolean;
  discord_live_role?: boolean;
  onboarding_completed?: boolean;
}

export interface EventMap {
  // Anonymous and cookieless. `gpc`: the browser's Global Privacy Control
  // answered before the banner could ask.
  consent_declined: { via: "button" | "gpc" };
  login_clicked: { source?: string };
  login_completed: { destination: "onboarding" | "dashboard"; is_new_user: boolean };
  // Not a login: a signed-in user granting extra Twitch rights for a feature.
  twitch_scope_granted: { feature: string };
  onboarding_started: NoProps;
  // The toggles as they stood when the wizard finished.
  onboarding_completed: Pick<Preferences, "memes_enabled" | "sync_clips_on_end" | "show_stream_stats">;

  // Overlay list.
  overlay_created: { overlay_id: string; template: string; render_mode: string };
  overlay_deleted: { overlay_id: string };
  overlay_duplicated: { overlay_id: string; source_overlay_id: string; item_count: number };
  overlay_imported: { overlay_id: string; item_count: number; custom_widget_count: number };
  overlay_exported: { overlay_id: string; item_count: number; custom_widget_count: number };
  overlay_key_reset: { overlay_id: string };
  overlay_favourite_toggled: { overlay_id: string; favourite: boolean };
  overlay_active_toggled: { overlay_id: string; active: boolean };
  // What one Save in the editor changed. The type lists hold each type once;
  // the counts say how many widgets.
  overlay_saved: {
    overlay_id: string;
    item_count: number;
    added_types: string[];
    added_count: number;
    removed_types: string[];
    removed_count: number;
    reconfigured_types: string[];
    reconfigured_count: number;
  };
  // Sent at save time, one per widget: a widget that was saved onto an
  // overlay, or saved off it. Not a widget dropped on the canvas and undone.
  widget_added: { overlay_id: string; widget: string; custom: boolean; custom_widget_id?: string };
  widget_removed: { overlay_id: string; widget: string; custom: boolean; custom_widget_id?: string };

  // Custom widgets. "starter" is one of our templates, "library" another
  // streamer's published widget.
  custom_widget_created: { widget_id: string };
  custom_widget_published: { widget_id: string };
  custom_widget_installed: { widget_id: string; install_source: "starter" | "library" };

  // Media library.
  media_uploaded: { mime_type: string; size_kb: number };
  media_deleted: { mime_type: string; size_kb: number };

  // Clips and VODs. `trigger` says what started a sync: the button, the
  // onboarding step, or a stream ending.
  clips_synced: { trigger: "manual" | "stream_end"; skipped: boolean; new_clip_count?: number };
  clip_folder_created: { is_subfolder: boolean };
  clip_folder_deleted: NoProps;
  clip_added_to_folder: NoProps;
  clip_removed_from_folder: NoProps;
  clip_downloaded: { orientation: "landscape" | "portrait" };
  vod_clip_created: { duration_s: number };
  stream_marker_created: NoProps;

  // Paid products. `product_gate_hit` is someone reaching for a product their
  // plan does not include.
  product_gate_hit: { product: string };
  cloud_obs_launched: NoProps;
  cloud_obs_launch_failed: {
    reason: "no_capacity" | "no_subscription" | "missing_twitch_scope" | "node_refused";
    status?: number;
  };
  // "ingest" is the key the phone streams to, "output" the one a platform gets.
  ingest_key_created: { kind: "ingest" | "output" };
  ingest_key_rotated: { kind: "ingest" | "output" };
  ingest_key_deleted: { kind: "ingest" | "output" };
  auto_switcher_config_saved: NoProps;
  scene_override_set: { timed: boolean };
  scene_override_cleared: NoProps;

  // Dashboard actions no server action sees. The browser reports them through
  // POST /api/activity and they arrive with `relayed: true`.
  overlay_url_copied: { overlay_id: string; location: "create_dialog" | "card" | "editor" };
  cloud_obs_started: { location: "dashboard" | "deck" };
  cloud_obs_stopped: { location: "dashboard" | "deck" };
  clip_played: NoProps;
  clip_link_copied: NoProps;
  onboarding_step_completed: { step_id: string; step_index: number; total_steps: number };
  // Once per event type per editor visit, not per click: the simulators loop.
  test_alert_fired: { event_type: string; mode: "local" | "live" };
  // `held`: the auto switcher is on, so the scene was pinned as well.
  deck_scene_switched: { held: boolean };
  clips_filtered: { filters: string[] };
  deck_chat_sent: NoProps;
  stream_info_updated: NoProps;

  // Account.
  preferences_saved: Preferences;
  data_export_requested: NoProps;
  discord_unlinked: NoProps;
  account_deleted: { account_age_days: number | null };
  discord_linked: { role_status: string; source: "onboarding" | "settings" };
  discord_guild_joined: { linked: boolean };
  // Sent by the rendered overlay itself, so they describe real use on stream
  // rather than what someone configured. Keyed on the overlay's owner.
  overlay_loaded: {
    overlay_id: string;
    render_mode: string;
    widget_types: string[];
    widget_count: number;
    has_custom_widget: boolean;
    client: OverlayClient;
    obs_version?: string;
  };
  overlay_heartbeat: {
    overlay_id: string;
    uptime_s: number;
    client: OverlayClient;
    // "unknown" until OBS says either way: it reports changes, not the state
    // a source loaded in.
    on_program: boolean | "unknown";
    streaming: boolean | "unknown";
    clips_played: number;
    alerts_shown: number;
  };
  // A slash command or right-click entry in our Discord server. People who
  // have not linked a StreamWizard account all share one id.
  discord_command_used: {
    command: string;
    subcommand?: string;
    kind: "slash" | "context_menu";
    linked: boolean;
    ok: boolean;
  };
  // Chat commands the Twitch bot answered in a channel, added up per five
  // minutes: `count` uses in one event. `command` only for our own defaults.
  chat_command_used: { command_type: "custom" | "default"; command?: string; count: number };
  // Public marketing pages. `$pathname` is on every event, so none of these
  // carry the page; `section` / `cta` say where on the page.
  cta_clicked: { cta: string; section: string; href: string; external: boolean };
  section_viewed: { section: string };
  // Demos add their own detail (which tab, which scene), hence the open tail.
  demo_interacted: { demo: string; action: string; first_touch: boolean; [detail: string]: unknown };
  faq_opened: { question: string };
}

export type AppEvent = keyof EventMap;

// Events without properties can be captured with the name alone.
export type EventProps<E extends AppEvent> = NoProps extends EventMap[E]
  ? [properties?: EventMap[E]]
  : [properties: EventMap[E]];
