import { createMessage } from "./model";
import type { BannerDraft, BuiltMessage, ButtonDraft, ButtonsDraft, ElementDraft, EmbedDraft } from "./schema";

// Starting points for the "Add element" menu. A feature passes the builder
// the presets that make sense for it; the text is only a first draft the
// admin then edits. Wording follows docs/tone_of_voice.md.

export type PresetSkeleton = "banner" | "embed" | "list" | "columns" | "buttons";

export interface ElementPreset {
  id: string;
  label: string;
  description: string;
  /** Which miniature the preset card draws. */
  skeleton: PresetSkeleton;
  draft: ElementDraft;
}

/** StreamWizard's embed accent (docs/branding.md). */
export const DEFAULT_EMBED_COLOR = 0x9146ff;

const banner = (text: string): BannerDraft => ({ type: "banner", text, image: null });

const embed = (patch: Partial<Omit<EmbedDraft, "type">>): EmbedDraft => ({
  type: "embed",
  title: "",
  description: "",
  color: DEFAULT_EMBED_COLOR,
  fields: [],
  footer: "",
  ...patch,
});

const buttons = (...row: ButtonDraft[]): ButtonsDraft => ({ type: "buttons", buttons: row });

const preset = (
  id: string,
  label: string,
  description: string,
  skeleton: PresetSkeleton,
  draft: ElementDraft,
): ElementPreset => ({ id, label, description, skeleton, draft });

export const BLANK_EMBED_PRESET = preset(
  "advanced-embed",
  "Advanced embed",
  "Blank embed with every option.",
  "embed",
  embed({ title: "Title", description: "Write something here." }),
);

export const BLANK_BANNER_PRESET = preset("custom-banner", "Custom banner", "Blank banner. Bring your own image.", "banner", banner(""));

export const BUTTONS_PRESET = preset(
  "buttons",
  "Buttons",
  "A row of buttons: links, or actions the bot answers.",
  "buttons",
  buttons({ kind: "link", label: "Visit the website", url: "https://streamwizard.org" }),
);

const LINK_ACCOUNT_EMBED = embed({
  title: "Link your StreamWizard account",
  description: [
    "Connect your Discord account to StreamWizard, so the bot knows which StreamWizard account is yours.",
    "",
    "**What you get**",
    "- **Tickets**: open a support ticket here and we see your account right away, so we can help you faster. Linked accounts also get a little more priority.",
    "- **Streamer channels**: access to the channels where streamers find collabs and swap tips.",
    "- **Live notifications**: we post it here when you go live.",
    "- **Live role**: a role that shows you are live right now.",
    "",
    "**Already linked?**",
    "If you connected Discord during onboarding on the StreamWizard dashboard, you are set. Not sure? Press **Check link status** and the bot tells you.",
    "",
    "**How it works**",
    "1. Press **Check link status** below. Only you see the reply.",
    "2. Not linked yet? The reply has a link. Follow it and sign in to StreamWizard.",
    "3. Approve the Discord connection. Done.",
  ].join("\n"),
});

const LINK_ACCOUNT_BUTTONS = buttons({ kind: "action", label: "Check link status", action: "link_account", style: "primary" });

const WELCOME_EMBED = embed({
  title: "Welcome to [server.name]",
  description:
    "Good to have you here. Read the rules below, grab a role and say hi.\n\nThere are [server.member_count] of us now.",
});

const RULES_EMBED = embed({
  title: "Rules",
  description: [
    "1️⃣ Be kind. No harassment, hate speech or personal attacks.",
    "2️⃣ No spam, and no self-promo unless a channel is made for it.",
    "3️⃣ Keep it safe for work.",
    "4️⃣ Stay on topic. Each channel says what it's for.",
    "5️⃣ Mods have the final word. If something is off, tell them.",
  ].join("\n"),
});

const INVITE_EMBED = embed({
  title: "Bring a friend",
  description: "Share this link to invite people to [server.name]:\nhttps://discord.gg/your-invite",
});

const MODS_EMBED = embed({
  title: "Mod team",
  description:
    "These people keep [server.name] running. Need help or want to report something? Message one of them.\n\n👑 **Owner**: @name\n🛡️ **Mods**: @name, @name",
});

const LINKS_EMBED = embed({
  title: "Links",
  fields: [
    { name: "Watch", value: "[Twitch](https://twitch.tv/your-channel)\n[YouTube](https://youtube.com/@your-channel)", inline: true },
    { name: "Follow", value: "[X](https://x.com/your-handle)\n[Instagram](https://instagram.com/your-handle)", inline: true },
  ],
});

export const MESSAGE_PRESETS: ElementPreset[] = [
  BLANK_EMBED_PRESET,
  BLANK_BANNER_PRESET,
  BUTTONS_PRESET,
  preset("link-account-buttons", "Link account button", "Members link their StreamWizard account.", "buttons", LINK_ACCOUNT_BUTTONS),
  preset("welcome-embed", "Welcome embed", "A short hello for new members.", "embed", WELCOME_EMBED),
  preset("welcome-banner", "Welcome banner", "Banner that says Welcome.", "banner", banner("Welcome")),
  preset("rules-embed", "Rules embed", "Numbered rules list.", "list", RULES_EMBED),
  preset("rules-banner", "Rules banner", "Banner that says Rules.", "banner", banner("Rules")),
  preset("invite-embed", "Invite embed", "Text plus your invite link.", "embed", INVITE_EMBED),
  preset("invite-banner", "Invite banner", "Banner that says Invite Link.", "banner", banner("Invite Link")),
  preset("mods-embed", "Mods embed", "Who runs the server.", "embed", MODS_EMBED),
  preset("mods-banner", "Mods banner", "Banner that says Mods.", "banner", banner("Mods")),
  preset("links-embed", "Links embed", "Two columns of links.", "columns", LINKS_EMBED),
  preset("links-banner", "Links banner", "Banner that says Links.", "banner", banner("Links")),
];

// What a new message starts from. Only a first draft: every element can be
// edited, removed or added to afterwards.

export interface MessageTemplate {
  id: string;
  label: string;
  description: string;
  /** Suggested name for the message in the dashboard. */
  name: string;
  /** Fresh element ids every call. */
  create: () => BuiltMessage;
}

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: "blank",
    label: "Blank",
    description: "One empty embed. Build the rest yourself.",
    name: "New message",
    create: () => createMessage([BLANK_EMBED_PRESET.draft]),
  },
  {
    id: "welcome",
    label: "Welcome and rules",
    description: "A hello and a rules list, each under a banner.",
    name: "Welcome",
    create: () => createMessage([banner("Welcome"), WELCOME_EMBED, banner("Rules"), RULES_EMBED]),
  },
  {
    id: "rules",
    label: "Rules",
    description: "A banner and a numbered rules list.",
    name: "Rules",
    create: () => createMessage([banner("Rules"), RULES_EMBED]),
  },
  {
    id: "links",
    label: "Links",
    description: "A banner and two columns of links.",
    name: "Links",
    create: () => createMessage([banner("Links"), LINKS_EMBED]),
  },
  {
    id: "link-account",
    label: "Link account",
    description: "An embed with a button that links a member's StreamWizard account.",
    name: "Link account",
    create: () => createMessage([LINK_ACCOUNT_EMBED, LINK_ACCOUNT_BUTTONS]),
  },
];
