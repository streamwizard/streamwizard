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

export interface EventMap {
  login_clicked: { source?: string };
  login_completed: { destination: "onboarding" | "dashboard"; is_new_user: boolean };
  onboarding_started: NoProps;
  onboarding_completed: NoProps;
  clips_synced: { source: "onboarding" | "dashboard"; skipped: boolean };
  clip_folder_created: { is_subfolder: boolean };
  overlay_created: { template: string; render_mode: string };
  overlay_favourite_toggled: { favourite: boolean };
  widget_added: { custom: boolean; widget?: string; preset?: string };
  cloud_obs_launched: NoProps;
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
