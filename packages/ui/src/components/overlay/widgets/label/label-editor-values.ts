import type {
  LabelDefinition,
  LabelEntryKind,
  LabelLeader,
  LatestLabelKey,
  LabelTopKey,
  ResolvedLabel,
} from "@repo/schemas";
import type { EditorLabelValue } from "../../hooks/use-editor-preview-values";

const LATEST_KINDS: Record<LatestLabelKey, LabelEntryKind> = {
  follower: "follow",
  subscriber: "sub",
  new_subscriber: "sub",
  resubscriber: "resub",
  gift: "gift",
  cheer: "cheer",
  raid: "raid",
  redemption: "redemption",
  shoutout: "shoutout",
  hype_train: "hype_train",
};

const TOP_KINDS: Record<LabelTopKey, LabelEntryKind> = {
  cheer: "cheer",
  raid: "raid",
  hype_level: "hype_train",
};

/** Which parts of a label the Saved data tab can set. Lists can't be typed in. */
export function editableLabelParts(def: LabelDefinition): { name: boolean; amount: boolean } | null {
  switch (def.shape) {
    case "list":
      return null;
    case "number":
      return { name: false, amount: true };
    case "leaders":
      return { name: true, amount: true };
    case "entry":
      return { name: true, amount: def.template.includes("{amount}") };
  }
}

/**
 * Lays a value typed into the editor over what the label resolved to. Parts
 * left empty keep the real value, so typing only a name keeps the real amount.
 */
export function applyEditorLabelValue(
  resolved: ResolvedLabel,
  def: LabelDefinition,
  value: EditorLabelValue | undefined,
  now = Date.now()
): ResolvedLabel {
  if (!value || (value.name === undefined && value.amount === undefined)) return resolved;
  switch (resolved.shape) {
    case "list":
      return resolved;
    case "number":
      return value.amount === undefined ? resolved : { shape: "number", value: value.amount };
    case "leaders": {
      const first = resolved.items[0];
      const leader: LabelLeader = {
        id: first?.id ?? "editor",
        login: first?.login ?? null,
        name: value.name ?? first?.name ?? "",
        amount: value.amount ?? first?.amount ?? 0,
      };
      return { shape: "leaders", items: [leader, ...resolved.items.slice(1)] };
    }
    case "entry": {
      const src = def.source;
      const kind =
        resolved.entry?.kind ??
        (src.from === "latest" ? LATEST_KINDS[src.key] : src.from === "top" ? TOP_KINDS[src.key] : "follow");
      return {
        shape: "entry",
        entry: {
          ...resolved.entry,
          kind,
          name: value.name ?? resolved.entry?.name ?? "",
          amount: value.amount ?? resolved.entry?.amount,
          at: resolved.entry?.at ?? new Date(now).toISOString(),
        },
      };
    }
  }
}
