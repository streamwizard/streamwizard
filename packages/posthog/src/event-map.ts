// One place for every custom event and the properties it carries. Add here
// first, then capture. No SDK imports: the browser helper (events.ts) and the
// server helper (server.ts) both type against this, and neither should pull in
// the other's SDK.
//
// PostHog enforces no schema, so a misspelled property silently becomes a new
// one and the chart built on the old name goes flat. Typing them here is the
// only check there is.

type NoProps = Record<string, never>;

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
