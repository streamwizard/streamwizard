import type { BuiltMessage, ElementPreset, ThemeDefinition, VariableDefinition } from "@repo/discord-message";

// The builder knows nothing about the feature it sits in. Everything that
// differs per use (presets, variables, themes, limits, gating, uploads)
// arrives through these props.

/** Set on a preset or theme to show it with a badge and keep it from being picked, e.g. "Premium". */
export interface Lockable {
  locked?: string;
}

export type BuilderPreset = ElementPreset & Lockable;

export type BuilderTheme = ThemeDefinition & Lockable & { imageUrl: string };

export interface MessageBuilderProps {
  value: BuiltMessage;
  /** Called with the whole next message on every edit. The builder keeps no copy of its own. */
  onChange: (next: BuiltMessage) => void;
  /** Cards in the "Add element" menu, in order. */
  presets: BuilderPreset[];
  /** Placeholders this feature can fill. Anything else typed as [x.y] is flagged. */
  variables: VariableDefinition[];
  /** Every theme a banner may resolve to. Needs the default theme at least when the feature has banners. */
  themes: BuilderTheme[];
  /** Hide the "Choose your theme" panel where themes don't fit. Banners then use the default theme or an upload. */
  themePanel?: boolean;
  /** Who the preview message is from. */
  bot: { name: string; avatarUrl?: string | null };
  /** Shows "Reset to default" when set. */
  onReset?: () => void;
  /** Stores the file and resolves to its public https URL. Leave out to turn uploads off. */
  onUploadImage?: (file: File) => Promise<string>;
  /** Called when a locked preset or theme is clicked, e.g. to open an upgrade page. */
  onLockedClick?: (item: BuilderPreset | BuilderTheme) => void;
  /** Set where an empty message is a valid choice. Shown in place of the "add something" prompt, and the empty-message error stays away. */
  emptyText?: string;
  /** One embed and nothing else: no banners, no add menu, no reordering. */
  singleEmbed?: boolean;
  maxElements?: number;
  disabled?: boolean;
}
