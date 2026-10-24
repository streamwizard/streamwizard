/**
 * One fake cast for every screenshot in the docs.
 *
 * docs/branding.md asks for real-looking data and forbids publishing a real
 * viewer's name, so these are invented but plausible. Keeping them in one
 * place means a name is never a real person's by accident, and the images do
 * not date when somebody changes their Twitch handle.
 */
export const VIEWERS = [
  "novaplays",
  "kettlecorn",
  "bitpilot",
  "m0ss",
  "ravenought",
  "tinwolf",
  "pixelpenguin",
  "sandwichlord",
  "nightowlnia",
  "cozycactus",
] as const;

/** The channel every screenshot is of. Not a real Twitch account. */
export const BROADCASTER = {
  id: "900000001",
  name: "novaplays",
  display: "novaplays",
} as const;

/**
 * Clip titles that read like a real library: short, specific, a bit scrappy.
 * "Test Clip 1" is exactly what the branding doc forbids.
 */
export const CLIP_TITLES = [
  "that was not supposed to work",
  "one hp. ONE.",
  "chat called it three minutes ago",
  "the wall was load bearing",
  "perfect run until the very last jump",
  "accidental speedrun strat",
  "I have no idea what I just did",
  "raid train arrives, chaos follows",
  "600 IQ or pure luck, you decide",
  "the physics engine gave up",
  "clutch with the last bullet",
  "never doing that again",
] as const;

export const GAMES = [
  { id: "509658", name: "Just Chatting" },
  { id: "32982", name: "Grand Theft Auto V" },
  { id: "263490", name: "Rust" },
  { id: "516575", name: "VALORANT" },
] as const;
