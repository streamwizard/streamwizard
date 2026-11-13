import type { FaqItem } from "@/components/public/home/faq-accordion";

/*
 * Every word on /smp that describes the server, in one place.
 *
 * Only facts about the mod and the server as they are: the version, the mods,
 * the redeems, the Rift, the missiles, the two custom mobs. No launch date,
 * no number of slots, no entry requirements and no price, because none of
 * those are decided. The redeems are not set up from the StreamWizard
 * dashboard yet, so nothing here says or links that they are.
 */

export const SMP_SERVER_ADDRESS = "smp.streamwizard.org";
export const SMP_MINECRAFT_VERSION = "Minecraft Java 26.3";

/** A 16x16 texture from the mod, drawn at a whole multiple of its size. Decorative: the text says what it is. */
export type SmpSprite =
  | "rift-key"
  | "missile-small"
  | "missile-medium"
  | "missile-large"
  | "missile-heavy"
  | "launch-pad-top"
  | "decoy"
  | "turret"
  | "loot-crate"
  | "coen"
  | "crazy-noob";

export interface SmpFeature {
  title: string;
  text: string;
  sprites?: readonly SmpSprite[];
  /** Shown in a monospace box under the text, for something to copy. */
  code?: string;
}

export const SMP_VIEWER_FEATURES: readonly SmpFeature[] = [
  {
    title: "Jumpscares",
    text: "A door that stays shut while zombies bang on it. Something waiting behind the next door you open. An enderman scare, fake damage, fireworks, or getting spun around.",
  },
  {
    title: "Events",
    text: "You get launched into the air. A celebration goes off. A random mob spawns. Loot crates fall from the sky.",
    sprites: ["loot-crate"],
  },
  {
    title: "Disasters",
    text: "A wind storm. A supernova: a rocket from the sky that leaves a crater. Or a nuke strike.",
  },
  {
    title: "Mimic trap",
    text: "A chest turns into a mimic, runs off with your loot and buries it, unless you kill it in time.",
  },
  {
    title: "Minions",
    text: "A viewer takes control of a mob next to you, in help mode or troll mode, and steers it with chat commands.",
  },
];

export const SMP_STREAMER_FEATURES: readonly SmpFeature[] = [
  {
    title: "The Rift",
    text: "Every player has a personal pocket dimension. Craft a Rift Key from 4 amethyst shards, an ender pearl and a gold ingot to open yours. Redeems can't reach you there.",
    sprites: ["rift-key"],
  },
  {
    title: "Missiles",
    text: "Craft missiles in four sizes: small, medium, large and heavy. Launch pads, decoys and defense turrets are craftable too.",
    sprites: ["missile-small", "missile-medium", "missile-large", "missile-heavy", "launch-pad-top", "decoy", "turret"],
  },
  {
    title: "Coen and the Crazy Noob",
    text: "Coen is a villager-like NPC with a Dutch voice. Hit him three times and he snaps. The Crazy Noob is a clumsy mob that is scared of everything.",
    sprites: ["coen", "crazy-noob"],
  },
  {
    title: "Voice, maps and terrain",
    text: "Simple Voice Chat gives you proximity voice. Xaero's minimap and world map show you where you are. The world is Tectonic terrain. Everything else is normal survival.",
  },
];

export const SMP_REQUIREMENTS: readonly SmpFeature[] = [
  {
    title: SMP_MINECRAFT_VERSION,
    text: "The server runs on Fabric. You need the Java edition of the game.",
  },
  {
    title: "The Streamwizard modpack",
    text: "Install the modpack called Streamwizard from Modrinth. The mod is required on your side, so you can't join without it.",
  },
  {
    title: "The server address",
    text: "Add the server under Multiplayer with this address.",
    code: SMP_SERVER_ADDRESS,
  },
];

/*
 * Also feeds the page's FAQPage JSON-LD, so every answer stands on its own:
 * AI answers quote them without the page around them.
 */
export const SMP_FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: "What is the StreamWizard Minecraft SMP?",
    answer:
      "The StreamWizard Minecraft SMP is a survival multiplayer server for Twitch streamers, running Minecraft Java 26.3 on Fabric. Viewers trigger things on the streamer through Twitch redeems: jumpscares, events, disasters, a mimic trap, and mobs they control themselves. Outside those redeems it is normal survival Minecraft.",
  },
  {
    question: "When does the server launch?",
    answer: "There is no launch date yet. Applications are open now, and the date will be announced.",
  },
  {
    question: "How do I join the waitlist?",
    answer:
      "Sign in to StreamWizard with Twitch, link your Discord account and join the StreamWizard Discord server. Then enter your Minecraft Java name and three things about your channel on the SMP page: your average viewers, the language you stream in and how often you stream. That puts you on the waitlist.",
  },
  {
    question: "What do I need to install?",
    answer:
      "Minecraft Java 26.3 and the modpack called Streamwizard from Modrinth. The server runs on Fabric, and the StreamWizard mod is required on your side, so you can't join without it. The server address is smp.streamwizard.org.",
  },
  {
    question: "What can viewers do to me?",
    answer:
      "Viewers use Twitch redeems. Jumpscares: a door that stays shut while zombies bang on it, something waiting behind the next door you open, an enderman scare, fake damage, fireworks, or getting spun around. Events: getting launched into the air, a celebration, a random mob spawn, or loot crates falling from the sky. Disasters: a wind storm, a supernova (a rocket from the sky that leaves a crater) or a nuke strike. The mimic trap turns a chest into a mimic that runs off with your loot and buries it unless you kill it in time. With minions, a viewer takes control of a mob next to you and steers it with chat commands, in help mode or troll mode.",
  },
  {
    question: "Is there anywhere viewers can't reach me?",
    answer:
      "Yes, the Rift. Every player has a personal pocket dimension, opened with a craftable Rift Key: 4 amethyst shards, an ender pearl and a gold ingot. Redeems can't reach you while you are in there.",
  },
  {
    question: "Is there voice chat?",
    answer: "Yes. The server uses Simple Voice Chat, which is proximity voice: you hear the players near you.",
  },
  {
    question: "Can I change my Minecraft name after I sign up?",
    answer:
      "Yes. Come back to the SMP page while you are signed in and change it there. We look the name up again and store the account's UUID with it, because the UUID is what the server uses to let players in.",
  },
];
