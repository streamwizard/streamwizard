/** Where the ingest source warning is. */
export type IngestSourceAlertState = "hidden" | "open" | "restoring" | "failed";

/** What went wrong with an ingest source. */
export type IngestSourceProblem =
  /** Taken out of a scene. */
  | { kind: "removed"; sceneName: string; sourceName: string }
  /** Its URL no longer pulls one of the user's feeds. */
  | { kind: "broken"; sourceName: string };

/** What the OBS viewer's "Add browser source" dialog adds. */
export type BrowserSourceTarget =
  /** One of the user's StreamWizard overlays, link and size filled in. */
  | { kind: "overlay"; name: string; url: string; width: number; height: number; active: boolean }
  /** Any link the user pastes. */
  | { kind: "custom" };
