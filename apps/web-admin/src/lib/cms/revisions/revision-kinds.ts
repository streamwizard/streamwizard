// Revision kinds as the admin names them. Plain data, so server pages and
// client components can both import it.

export type RevisionKind = "autosave" | "manual" | "publish" | "restore";

export const REVISION_KIND_LABELS: Record<RevisionKind, string> = {
  autosave: "Autosave",
  manual: "Saved version",
  publish: "Published",
  restore: "Before a restore",
};
