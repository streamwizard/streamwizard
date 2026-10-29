// MOCK DATA, local dev only. Not real posts and not real authors.
//
// Blog posts and guides about streaming on Twitch, so the /blog and /guides
// search and filters have something to work on. `bun run cms:mock` writes
// them to the local Supabase; `bun run cms:mock:remove` takes them out again.
// Nothing here is meant for staging or production.

import type { Doc, DocNode } from "../../packages/cms/src/doc";

// ─── A tiny writer for Tiptap docs ──────────────────────────────────────────
// Inline: **bold** and `code`. Blocks: the helpers below.

function inline(text: string): DocNode[] {
  const nodes: DocNode[] = [];
  for (const part of text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)) {
    if (!part) continue;
    if (part.startsWith("**")) nodes.push({ type: "text", text: part.slice(2, -2), marks: [{ type: "bold" }] });
    else if (part.startsWith("`")) nodes.push({ type: "text", text: part.slice(1, -1), marks: [{ type: "code" }] });
    else nodes.push({ type: "text", text: part });
  }
  return nodes;
}

const p = (text: string): DocNode => ({ type: "paragraph", content: inline(text) });
const h2 = (text: string): DocNode => ({ type: "heading", attrs: { level: 2 }, content: inline(text) });
const h3 = (text: string): DocNode => ({ type: "heading", attrs: { level: 3 }, content: inline(text) });
const items = (list: string[]) => list.map((item) => ({ type: "listItem", content: [p(item)] }));
const ul = (list: string[]): DocNode => ({ type: "bulletList", content: items(list) });
const ol = (list: string[]): DocNode => ({ type: "orderedList", attrs: { start: 1 }, content: items(list) });
const callout = (variant: "info" | "tip" | "warning", text: string): DocNode => ({
  type: "callout",
  attrs: { variant },
  content: [p(text)],
});
const code = (text: string, language: string | null = null): DocNode => ({
  type: "codeBlock",
  attrs: { language },
  content: [{ type: "text", text }],
});

export const doc = (...content: DocNode[]): Doc => ({ type: "doc", content });

// ─── Taxonomy ───────────────────────────────────────────────────────────────

export const MOCK_AUTHORS = [
  { key: "alex", slug: "mock-author-alex", name: "Alex Mock", role_title: "Mock author (sample data)" },
  { key: "robin", slug: "mock-author-robin", name: "Robin Sample", role_title: "Mock author (sample data)" },
] as const;

export const MOCK_CATEGORIES = [
  { slug: "tech", name: "Tech", description: "OBS, encoding, audio and scene design." },
  { slug: "networking", name: "Networking", description: "Upload speed, routers and dropped frames." },
  { slug: "growth", name: "Growth", description: "Discoverability, raids, schedules and community." },
  { slug: "monetization", name: "Monetization", description: "Subs, Bits and sponsors." },
  { slug: "moderation", name: "Moderation", description: "AutoMod, chat rules and mod teams." },
] as const;

export const MOCK_TAGS = [
  { slug: "obs", name: "OBS" },
  { slug: "encoding", name: "Encoding" },
  { slug: "bitrate", name: "Bitrate" },
  { slug: "audio", name: "Audio" },
  { slug: "scenes", name: "Scenes" },
  { slug: "upload-speed", name: "Upload speed" },
  { slug: "wifi", name: "Wi-Fi" },
  { slug: "router", name: "Router" },
  { slug: "dropped-frames", name: "Dropped frames" },
  { slug: "raids", name: "Raids" },
  { slug: "schedule", name: "Schedule" },
  { slug: "community", name: "Community" },
  { slug: "clips", name: "Clips" },
  { slug: "vods", name: "VODs" },
  { slug: "subs", name: "Subs" },
  { slug: "bits", name: "Bits" },
  { slug: "sponsorships", name: "Sponsorships" },
  { slug: "automod", name: "AutoMod" },
  { slug: "mod-team", name: "Mod team" },
] as const;

type CategorySlug = (typeof MOCK_CATEGORIES)[number]["slug"];
type TagSlug = (typeof MOCK_TAGS)[number]["slug"];
type AuthorKey = (typeof MOCK_AUTHORS)[number]["key"];

interface MockBase {
  slug: string;
  title: string;
  excerpt: string;
  summary: string;
  category: CategorySlug;
  tags: TagSlug[];
  authors: AuthorKey[];
  /** Days before today it was first published. */
  daysAgo: number;
  featured?: boolean;
  body: Doc;
}

export interface MockPost extends MockBase {
  type: "blog";
}

export interface MockGuide extends MockBase {
  type: "guide";
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedMinutes: number;
  prerequisites: string[];
  sections: { title: string; body: Doc }[];
}

export type MockContent = MockPost | MockGuide;

// ─── Blog posts ─────────────────────────────────────────────────────────────

export const MOCK_POSTS: MockPost[] = [
  {
    type: "blog",
    slug: "why-your-stream-looks-blurry",
    title: "Why your stream looks blurry at 6000 kbps",
    excerpt:
      "You maxed the bitrate and it still turns to mush the moment you spin the camera. The bitrate isn't the problem. What you ask it to carry is.",
    summary:
      "Bitrate is a budget. 1080p60 with lots of motion spends it fast. Drop to 900p or 720p60, use a slower encoder preset, and keep the keyframe interval at 2 seconds.",
    category: "tech",
    tags: ["encoding", "bitrate", "obs"],
    authors: ["alex"],
    daysAgo: 6,
    featured: true,
    body: doc(
      p("Every streamer hits this wall. The stream looks sharp in the menu, then the match starts and it falls apart into blocks. You check OBS and the bitrate is already as high as Twitch takes."),
      h2("Bitrate is a budget, not a quality knob"),
      p("Think of bitrate as how many bits per second you get to describe the picture. A still webcam shot barely uses any. A fast shooter with grass, smoke and particles needs far more than 6000 kbps to look clean at 1080p60."),
      p("When the budget runs out, the encoder throws away detail. That's the smear you see."),
      h2("Spend the budget on fewer pixels"),
      ul([
        "**1080p60** looks great for slow games and Just Chatting.",
        "**936p60 or 900p60** is the sweet spot for most action games at 6000 kbps.",
        "**720p60** holds up best in the busiest scenes, and it's kinder to viewers on mobile data.",
      ]),
      callout("tip", "Downscale in OBS with the Lanczos filter (Settings, Video). It keeps text sharper than Bilinear."),
      h2("Let the encoder work harder"),
      p("On NVENC, the `P5` or `P6` preset with multipass at quarter resolution gives you a cleaner picture than `P1` at the same bitrate. On x264, `veryfast` is the usual floor. Only go slower if your CPU stays under 80% during the busiest moment of your game."),
      p("Keep the keyframe interval at `2` seconds. Twitch expects it, and higher values make the player buffer longer when viewers join."),
      h2("Check it the way viewers see it"),
      p("Your preview in OBS is the picture before encoding, so it always looks fine. To see what viewers get, open your channel in a private window on another device and watch the busiest part of your game for a few minutes."),
      p("Pay attention to the moments that break first: fast camera turns, foliage, water, smoke and full-screen effects. If those hold up at the new resolution, the rest of the stream will too."),
      p("Then check the Twitch Inspector for your broadcast. A steady bitrate line with no gaps means the network side is fine and any remaining blur comes from the settings above, not your connection."),
      h2("When to stop tweaking"),
      p("There's no perfect setting, only a good trade. Once fast scenes look acceptable and text in your overlay is readable, stop. Viewers care much more about smooth motion and clear audio than about the last bit of sharpness in a grass texture."),
      p("Write your final settings down somewhere. The next OBS update or new game is a lot less scary when you know what you started from."),
    ),
  },
  {
    type: "blog",
    slug: "wired-vs-wifi-dropped-frames",
    title: "Wired vs Wi-Fi: what actually happens to your frames",
    excerpt:
      "Wi-Fi speed tests look fine, then you drop 4% of frames mid-stream. Speed isn't what breaks a stream. Consistency is.",
    summary:
      "Streaming needs steady upload, not peak upload. Wi-Fi adds jitter and short dropouts that a speed test averages away. A cable fixes most of it; if you can't run one, try a powerline or MoCA adapter.",
    category: "networking",
    tags: ["wifi", "dropped-frames", "upload-speed"],
    authors: ["robin"],
    daysAgo: 21,
    body: doc(
      p("A speed test measures a burst. Your stream is a marathon: the same few megabits every second, for hours. Wi-Fi is good at bursts and bad at marathons."),
      h2("Where the frames go"),
      p("When your connection stalls for half a second, OBS queues frames. If the stall lasts longer than the buffer, OBS drops them. Viewers see a stutter or a short freeze."),
      ul([
        "A microwave or a neighbour's router on the same channel causes short interference.",
        "Your phone joining the network can briefly slow everyone else.",
        "Walls and floors make the signal weaker, which makes retries more likely.",
      ]),
      h2("What fixes it"),
      ol([
        "Run an Ethernet cable. Even a long flat cable along the skirting board beats the best router.",
        "No cable possible? Powerline adapters work in most homes, MoCA if you have coax.",
        "Stuck on Wi-Fi? Use 5 GHz, sit in line of sight of the router, and lower your bitrate by 20%.",
      ]),
      callout("info", "OBS shows dropped frames under View, Docks, Stats. Watch the 'Dropped frames (network)' line, not the rendering or encoding lines."),
    ),
  },
  {
    type: "blog",
    slug: "the-audio-chain-most-streamers-skip",
    title: "The audio chain most streamers skip",
    excerpt:
      "Viewers forgive a soft picture. They leave over bad audio. Four filters in OBS fix most of it, in the right order.",
    summary:
      "Use noise suppression, then a noise gate, then a compressor, then a limiter. Set your mic to peak around -10 dB and keep game audio well under your voice.",
    category: "tech",
    tags: ["audio", "obs"],
    authors: ["alex"],
    daysAgo: 34,
    body: doc(
      p("Most streams don't need a new mic. They need the mic they have to go through a few filters before it reaches the viewer."),
      h2("The order matters"),
      ol([
        "**Noise suppression** removes the fan and the keyboard hum.",
        "**Noise gate** mutes the mic when you're not talking.",
        "**Compressor** evens out quiet mumbles and sudden shouts.",
        "**Limiter** is the safety net, so nothing ever clips.",
      ]),
      p("Put them in another order and they fight each other. A gate before suppression opens on fan noise. A limiter before the compressor does nothing useful."),
      h2("Levels that work"),
      p("Talk at your normal volume and watch the OBS mixer. Your voice should peak around -10 dB. Game audio sits about 10 to 15 dB under that, so viewers hear you over an explosion."),
      callout("tip", "Record a 30 second test with OBS's Record button and listen on headphones. Your ears catch what the meters don't."),
      h2("Game audio and alerts"),
      p("Your mic isn't the only thing in the mix. Game audio, music and alert sounds all compete with your voice. Put each on its own source so you can set them apart in the mixer."),
      p("Alerts are the usual culprit. A sub sound that's fine when the room is quiet is painful at full volume over a boss fight. Bring them down until they sit just under your voice, then test with a fake alert."),
      h2("Mind the music"),
      p("Music behind your voice should be felt more than heard. If chat ever asks what you just said, the music is too loud. Also check that you're allowed to play it: muted VODs cost you the clips and highlights you'd want later."),
    ),
  },
  {
    type: "blog",
    slug: "raids-are-a-growth-tool",
    title: "Raids are a growth tool, not a goodbye",
    excerpt:
      "The raid at the end of your stream is the one moment you can hand your viewers to someone else. Pick well and they come back the favour.",
    summary:
      "Raid channels a bit smaller than yours, in the same game or vibe, that you've actually watched. Tell your chat why. Then say hi in their chat when they raid back.",
    category: "growth",
    tags: ["raids", "community"],
    authors: ["robin"],
    daysAgo: 48,
    body: doc(
      p("Small streams grow through other small streams. A raid is the clearest way to make that happen, and most people treat it as a way to end the night."),
      h2("Who to raid"),
      ul([
        "Someone in the same game or with the same tone as you.",
        "A channel your size or a bit smaller, where 15 raiders feel like an event.",
        "A streamer you've watched before, so you can tell your chat why they'll like it.",
      ]),
      h2("Make the raid land"),
      p("Tell your chat who you're raiding and one thing that makes them worth watching. Raiders who know why they're there stay longer."),
      p("When you arrive, the raid message should be short and friendly. A wall of emotes covers the streamer's chat and nobody can read anything."),
      callout("info", "Twitch lets you raid any live channel that accepts raids. You don't need affiliate or partner status."),
    ),
  },
  {
    type: "blog",
    slug: "a-schedule-you-can-keep",
    title: "A schedule you can keep beats a schedule that looks good",
    excerpt:
      "Five nights a week looks great on a banner. Three nights you actually show up for builds an audience.",
    summary:
      "Viewers come back for predictable times. Start with fewer slots you can always hit, put them in the Twitch schedule, and add a slot only after a month without misses.",
    category: "growth",
    tags: ["schedule", "community"],
    authors: ["alex"],
    daysAgo: 63,
    body: doc(
      p("Viewers build habits around you. A habit needs the same time on the same day. Miss it twice and the habit is gone."),
      h2("Start smaller than you think"),
      p("Pick the slots you're sure of even in a busy week. For most people with a job or school, that's two or three evenings."),
      h2("Put it where people look"),
      ul([
        "The Twitch schedule on your channel page, so followers get reminders.",
        "Your Discord, pinned in an announcements channel.",
        "Your offline screen and panels.",
      ]),
      p("Only add a slot after a month with no misses. Growth comes from showing up, not from the number on the banner."),
    ),
  },
  {
    type: "blog",
    slug: "one-stream-a-week-of-clips",
    title: "Turning one stream into a week of clips",
    excerpt:
      "Your best moments are buried in a four hour VOD. Pull them out once a week and they keep finding new viewers long after you go offline.",
    summary:
      "Mark moments while you stream, cut 20 to 60 second clips the next day, and post one per day on short-video platforms with a line about where to find the full stream.",
    category: "growth",
    tags: ["clips", "vods"],
    authors: ["robin", "alex"],
    daysAgo: 77,
    body: doc(
      p("Live viewers find you through the directory. Everyone else finds you through clips. One stream has enough material for a week of posts if you plan for it."),
      h2("Mark moments while you're live"),
      p("Use a stream marker hotkey or ask your mods to clip anything funny. Finding moments later in a long VOD takes far longer than marking them as they happen."),
      h2("Cut for the platform"),
      ul([
        "Vertical 9:16 for TikTok, Shorts and Reels.",
        "Get to the point in the first two seconds.",
        "Burn in captions. Most people scroll with the sound off.",
      ]),
      callout("tip", "Turn on VOD storage under Creator Dashboard, Settings, Stream. Without it, past broadcasts disappear after a week."),
    ),
  },
  {
    type: "blog",
    slug: "where-streamer-income-comes-from",
    title: "Subs, Bits and sponsors: where streamer income comes from",
    excerpt:
      "Most small streamers expect subs to pay the bills. For a lot of channels, the money ends up spread across five places.",
    summary:
      "Subs are steady but split with Twitch. Bits pay one cent each. Ads depend on your settings. Sponsors and affiliate links often outgrow all three once you have a clear niche.",
    category: "monetization",
    tags: ["subs", "bits", "sponsorships"],
    authors: ["alex"],
    daysAgo: 92,
    body: doc(
      p("Getting affiliate feels like the start of being paid to stream. It is, but the money rarely comes from one place."),
      h2("The usual mix"),
      ul([
        "**Subs**: recurring, split between you and Twitch. Steady, and slow to grow.",
        "**Bits**: you get one cent per Bit. Spiky, tied to hype moments.",
        "**Ads**: depends on how many you run and when. Viewers notice.",
        "**Sponsors**: a flat fee or a cut of sales. Needs a clear audience.",
        "**Affiliate links**: small, but they add up for gear and setup content.",
      ]),
      h2("Don't chase all of them"),
      p("Pick the one that fits your stream. A cozy chat stream does well with subs and Bits. A gear-focused tech stream does better with affiliate links and sponsors."),
      h2("Make each one easy to find"),
      p("Viewers support streams in the way you make easy. Put a short line about subs in your panels, set up a Bits goal for something chat cares about, and keep affiliate links in one place instead of scattered over five panels."),
      p("Thank people the same way every time. Consistent thanks feel fair, and they show new viewers what support looks like on your channel without you having to ask."),
      h2("Watch the trend, not the day"),
      p("Income on a small channel swings a lot from week to week. One good raid can double a month. Look at three month averages before you change anything, and never judge a new idea on a single stream."),
      p("Keep a simple spreadsheet: date, hours streamed, average viewers, subs, Bits and any sponsor income. After a few months it tells you more than any dashboard about which parts of your stream earn and which don't."),
    ),
  },
  {
    type: "blog",
    slug: "build-a-mod-team-early",
    title: "Building a mod team before you need one",
    excerpt:
      "The first raid with a troll in it is the wrong moment to look for a mod. Pick people early, while chat is quiet.",
    summary:
      "Pick regulars who already set the tone you want. Give them written rules and clear limits, and back their calls in public. Fix disagreements in private.",
    category: "moderation",
    tags: ["mod-team", "automod", "community"],
    authors: ["robin"],
    daysAgo: 118,
    body: doc(
      p("Small chats feel like they don't need moderation. Then a clip takes off, a raid comes in, and you're reading chat while also trying to play."),
      h2("Who to ask"),
      p("Look for regulars who already greet new people and calm things down. The best mod is someone chat already listens to."),
      h2("Give them something to work with"),
      ol([
        "Written chat rules, pinned in your panels and Discord.",
        "What gets a warning, what gets a timeout, what gets a ban.",
        "A private channel to talk about calls after the stream.",
      ]),
      callout("warning", "Never overrule a mod in front of chat. Talk it through afterwards, in private."),
      h2("Tools that take the load off"),
      p("Mods shouldn't have to catch everything by hand. Turn on AutoMod so the worst messages wait for review, add blocked terms for the things your community keeps running into, and use follower-only mode during raids from channels you don't know."),
      p("A shared timeout reason list helps too. When every mod uses the same short reasons, viewers learn the rules faster and nobody argues about why a message went."),
      h2("Say thank you"),
      p("Mods are volunteers. Shout them out on stream, give them a role in your Discord, and check in now and then about how it's going. A mod who feels supported sticks around for years."),
    ),
  },
  {
    type: "blog",
    slug: "what-qos-can-and-cant-fix",
    title: "What a router's QoS setting can and can't fix",
    excerpt:
      "QoS sounds like a cure for a busy home network. It helps with one specific problem, and does nothing for most others.",
    summary:
      "QoS decides who goes first when your upload is full. It helps when someone uploads or games while you stream. It can't add bandwidth, and it can't fix Wi-Fi interference.",
    category: "networking",
    tags: ["router", "upload-speed", "dropped-frames"],
    authors: ["alex"],
    daysAgo: 140,
    body: doc(
      p("Quality of Service, or QoS, tells the router which traffic to send first when there's a queue. On a home connection, the queue that matters is your upload."),
      h2("When it helps"),
      ul([
        "Someone in the house backs up photos to the cloud while you're live.",
        "A console downloads an update and its upload chatter piles up.",
        "Video calls in another room share your upload.",
      ]),
      h2("When it doesn't"),
      p("If your upload is 5 Mbps and you stream at 6000 kbps, no setting saves you. Lower the bitrate. QoS also can't fix a weak Wi-Fi signal: the problem is between your PC and the router, before QoS gets a say."),
      callout("tip", "If your router has 'Smart Queue' or 'SQM', try that first. It handles most homes without picking devices by hand."),
    ),
  },
];

// ─── Guides ─────────────────────────────────────────────────────────────────

export const MOCK_GUIDES: MockGuide[] = [
  {
    type: "guide",
    slug: "set-up-obs-for-your-first-stream",
    title: "Set up OBS for your first Twitch stream",
    excerpt: "From a fresh install to a live stream with a webcam, a game and a mic that sounds right.",
    summary: "Connect your Twitch account, add a game and webcam scene, set the output to 6000 kbps at 1080p or 720p60, check your audio, and go live.",
    category: "tech",
    tags: ["obs", "scenes", "encoding"],
    authors: ["alex"],
    daysAgo: 3,
    featured: true,
    difficulty: "beginner",
    estimatedMinutes: 30,
    prerequisites: [],
    body: doc(p("This guide takes a fresh OBS install to your first stream. It skips the settings you can leave alone and explains the ones you can't.")),
    sections: [
      {
        title: "Connect your account",
        body: doc(
          p("Open Settings, Stream. Pick Twitch as the service and click Connect Account. OBS fills in the stream key for you and adds the chat and activity docks."),
          callout("warning", "Never show your stream key on stream. Anyone with it can stream to your channel."),
        ),
      },
      {
        title: "Build your first scene",
        body: doc(
          p("A scene is a layout. Start with one called Game. Click the plus under Sources and add a Game Capture for your game, then a Video Capture Device for your webcam."),
          p("Drag the webcam into a corner and lock it with the padlock icon so it doesn't move by accident."),
        ),
      },
      {
        title: "Pick output settings",
        body: doc(
          ul([
            "Encoder: NVENC on NVIDIA, AMF on AMD, QuickSync on Intel. x264 only if you have nothing else.",
            "Bitrate: 6000 kbps, or less if your upload is under 10 Mbps.",
            "Keyframe interval: 2.",
            "Output resolution: 1080p for slow games, 720p60 for fast ones.",
          ]),
        ),
      },
      {
        title: "Check your mic",
        body: doc(
          p("Talk at normal volume and watch the mixer. Aim for peaks around -10 dB. Right-click the mic, open Filters, and add Noise Suppression to start."),
        ),
      },
      {
        title: "Go live",
        body: doc(
          p("Set a title and category in the Stream Info dock, then press Start Streaming. Keep the Stats dock open for the first few minutes and watch for dropped frames."),
          callout("tip", "Do a test stream first. Add `?bandwidthtest=true` to the end of your stream key and nobody sees it."),
        ),
      },
    ],
  },
  {
    type: "guide",
    slug: "pick-encoder-and-bitrate",
    title: "Pick the right encoder and bitrate for your upload",
    excerpt: "Match your encoder, resolution and bitrate to the upload speed you actually have.",
    summary: "Use about 75% of your tested upload for video. Pick a hardware encoder if you have one, then choose the resolution that bitrate can carry.",
    category: "tech",
    tags: ["encoding", "bitrate", "upload-speed"],
    authors: ["robin"],
    daysAgo: 15,
    difficulty: "intermediate",
    estimatedMinutes: 20,
    prerequisites: ["OBS installed", "An upload speed test result"],
    body: doc(p("The right settings depend on two numbers: your upload speed and how much your PC can encode. This guide works through both.")),
    sections: [
      {
        title: "Work out your budget",
        body: doc(
          p("Take your tested upload and use about 75% for video. The rest covers audio, chat and anyone else in the house."),
          code("upload 12 Mbps  x 0.75  = 9 Mbps\nTwitch max          = 6000 kbps\nyour bitrate        = 6000 kbps", null),
        ),
      },
      {
        title: "Pick an encoder",
        body: doc(
          p("Hardware encoders (NVENC, AMF, QuickSync) run on the GPU and barely touch game performance. Modern NVENC looks as good as x264 `medium` at the same bitrate."),
        ),
      },
      {
        title: "Match resolution to bitrate",
        body: doc(
          ul(["6000 kbps: 1080p60 for slow games, 900p60 for fast ones.", "4500 kbps: 720p60.", "3000 kbps: 720p30, or 480p60 for fast games."]),
        ),
      },
      {
        title: "Test under load",
        body: doc(p("Run a test stream during the busiest part of your game for 10 minutes. If the Stats dock shows encoding lag, use a faster preset or a lower resolution.")),
      },
    ],
  },
  {
    type: "guide",
    slug: "clean-mic-chain-obs-filters",
    title: "Build a clean mic chain with OBS filters",
    excerpt: "Noise suppression, gate, compressor and limiter, set up in the right order with starting values.",
    summary: "Add four filters in order: suppression, gate, compressor, limiter. Start from the values here, then tune by ear with a test recording.",
    category: "tech",
    tags: ["audio", "obs"],
    authors: ["alex"],
    daysAgo: 29,
    difficulty: "intermediate",
    estimatedMinutes: 25,
    prerequisites: ["A USB or XLR mic set up in OBS"],
    body: doc(p("Every filter here goes on your mic source: right-click it in the mixer and pick Filters. Add them top to bottom in this order.")),
    sections: [
      { title: "Noise suppression", body: doc(p("Pick RNNoise. It removes fans and hum with almost no CPU. NVIDIA Broadcast is better if you have an RTX card."), callout("tip", "If your voice sounds robotic, suppression is too strong. Switch to Speex and set it to -20 dB.")) },
      { title: "Noise gate", body: doc(p("Start with close threshold -45 dB and open threshold -35 dB. Talk quietly: the gate should stay open. Stop talking: it should close within a second.")) },
      { title: "Compressor", body: doc(ul(["Ratio: 4:1", "Threshold: -18 dB", "Attack: 6 ms", "Release: 60 ms", "Output gain: until your peaks sit near -10 dB"])) },
      { title: "Limiter", body: doc(p("Set the threshold to -3 dB. It should almost never do anything. When you shout, it stops the audio from clipping.")) },
      { title: "Check by ear", body: doc(p("Record 30 seconds of talking, a laugh and a shout. Listen back on headphones. Meters lie; your ears don't.")) },
    ],
  },
  {
    type: "guide",
    slug: "scene-collections-nested-scenes-hotkeys",
    title: "Scene collections, nested scenes and hotkeys",
    excerpt: "Build scenes once and reuse them, so changing your layout never means editing ten scenes by hand.",
    summary: "Put shared parts like webcam and alerts in their own scenes, nest them into each layout, and bind every switch to a hotkey or Stream Deck button.",
    category: "tech",
    tags: ["scenes", "obs"],
    authors: ["robin"],
    daysAgo: 44,
    difficulty: "advanced",
    estimatedMinutes: 45,
    prerequisites: ["OBS installed", "A starting scene you already use"],
    body: doc(p("Once you have more than three scenes, editing them one by one gets old. Nested scenes fix that.")),
    sections: [
      { title: "Split out shared parts", body: doc(p("Make a scene called [Webcam] with just your camera and its frame. Do the same for [Alerts] and [Chat]. The brackets keep them sorted apart from real layouts.")) },
      { title: "Nest them into layouts", body: doc(p("In each layout, add a Scene source and pick [Webcam]. Move and resize it like any source. Change the frame once in [Webcam] and every layout updates.")) },
      { title: "Bind hotkeys", body: doc(p("Settings, Hotkeys. Give every layout a key you won't press by accident, like Ctrl+Alt+F1 to F8."), callout("info", "Hotkeys work while the game has focus, so you never need to alt-tab to switch scenes.")) },
      { title: "Keep collections for each show", body: doc(p("Use a separate scene collection for very different streams, like an IRL setup. Export it from the Scene Collection menu as a backup.")) },
    ],
  },
  {
    type: "guide",
    slug: "speed-test-that-tells-you-something",
    title: "Run a speed test that tells you something",
    excerpt: "Most speed tests measure the wrong thing for streaming. Here's how to get a number you can use.",
    summary: "Test wired, at the time you usually stream, to a server near a Twitch ingest. Look at upload and jitter, not download.",
    category: "networking",
    tags: ["upload-speed", "bitrate"],
    authors: ["alex"],
    daysAgo: 58,
    difficulty: "beginner",
    estimatedMinutes: 10,
    prerequisites: [],
    body: doc(p("Your download speed doesn't matter for streaming. Upload does, and so does how steady it is.")),
    sections: [
      { title: "Test like you stream", body: doc(ul(["Use the same PC and the same cable or Wi-Fi.", "Test at the time of day you usually go live.", "Close other uploads, like cloud backups."])) },
      { title: "Read the right numbers", body: doc(p("Note the upload speed and the jitter. Under 10 ms of jitter is good. Run three tests and use the lowest upload.")) },
      { title: "Turn it into a bitrate", body: doc(p("Use about 75% of the lowest upload for your video bitrate, up to Twitch's limit. The guide on picking an encoder covers the rest.")) },
    ],
  },
  {
    type: "guide",
    slug: "fix-dropped-frames",
    title: "Fix dropped frames, one cause at a time",
    excerpt: "Dropped frames have four common causes. Check them in this order and you'll find yours.",
    summary: "Look at which counter goes up in the Stats dock. Network drops mean a cable, a closer ingest or a lower bitrate. Encoding lag means a faster preset.",
    category: "networking",
    tags: ["dropped-frames", "wifi", "router"],
    authors: ["robin"],
    daysAgo: 72,
    difficulty: "intermediate",
    estimatedMinutes: 35,
    prerequisites: ["OBS stats dock open"],
    body: doc(p("Open View, Docks, Stats. The three counters there tell you which problem you have before you change anything.")),
    sections: [
      { title: "Read the stats dock", body: doc(ul(["Dropped frames (network): your connection.", "Skipped frames due to encoding lag: your encoder.", "Missed frames due to rendering lag: your GPU."])) },
      { title: "Network drops: check the path", body: doc(p("Use a cable if you can. Then check that OBS uses an ingest server near you; Auto is usually right."), callout("tip", "Turn on Dynamic Bitrate under Settings, Advanced, Network. OBS lowers the bitrate for a moment instead of dropping frames.")) },
      { title: "Network drops: check the house", body: doc(p("Pause cloud backups, console downloads and other uploads. If drops stop, set up QoS or Smart Queue on your router.")) },
      { title: "Encoding lag", body: doc(p("Switch to a hardware encoder or a faster preset. Lowering the output resolution helps too.")) },
      { title: "Rendering lag", body: doc(p("Cap your game's frame rate a few frames under your monitor's refresh rate. That leaves the GPU room to render the stream.")) },
    ],
  },
  {
    type: "guide",
    slug: "router-setup-for-streaming",
    title: "Router setup for streaming: QoS, reserved IPs and ports",
    excerpt: "What to change on your router, and the port forwarding you almost certainly don't need.",
    summary: "Give your streaming PC a reserved IP, turn on Smart Queue or QoS for it, and leave ports closed. Twitch streams go out, so no port forward is needed.",
    category: "networking",
    tags: ["router", "upload-speed"],
    authors: ["alex", "robin"],
    daysAgo: 96,
    difficulty: "advanced",
    estimatedMinutes: 40,
    prerequisites: ["Admin access to your router", "Your PC's local IP address"],
    body: doc(p("Router menus differ per brand, so this guide names the setting and what it does. Look for it under Advanced or LAN on most routers.")),
    sections: [
      { title: "Reserve your PC's IP", body: doc(p("Find DHCP reservation and pin your streaming PC to its current address. QoS rules and any port rules need an address that doesn't change.")) },
      { title: "Turn on Smart Queue or QoS", body: doc(p("Set your real upload and download speeds, about 90% of a speed test. Then give your streaming PC high priority."), callout("warning", "Entering a speed higher than your real one makes QoS do nothing.")) },
      { title: "Ports: when they matter", body: doc(p("Streaming to Twitch over RTMP is an outgoing connection. Your router allows it without any port forwarding. Ports only matter when something connects to you, like an SRT listener for an IRL setup or remote control of OBS.")) },
      { title: "Check it worked", body: doc(p("Start a large upload on another device, then do a test stream. With QoS working, your dropped frames stay at zero.")) },
    ],
  },
  {
    type: "guide",
    slug: "plan-your-first-raid-train",
    title: "Plan your first raid train",
    excerpt: "A chain of streamers raiding each other for a day. Here's how to set one up with friends without it falling apart.",
    summary: "Find four to eight streamers with similar audiences, agree on a shared doc with times, and keep a backup for every slot.",
    category: "growth",
    tags: ["raids", "community", "schedule"],
    authors: ["robin"],
    daysAgo: 110,
    difficulty: "beginner",
    estimatedMinutes: 15,
    prerequisites: [],
    body: doc(p("A raid train moves one audience through several channels in a row. Everyone gets new viewers, and it's fun for chat.")),
    sections: [
      { title: "Find your crew", body: doc(p("Four to eight streamers is plenty. Similar game or vibe matters more than similar size.")) },
      { title: "Make a shared schedule", body: doc(ul(["One doc with every slot, the streamer and their time zone.", "Slots of two to three hours.", "A backup name for every slot."])) },
      { title: "On the day", body: doc(p("Post in a shared Discord channel when you're 10 minutes from the raid. If the next streamer isn't live, raid the backup.")) },
    ],
  },
  {
    type: "guide",
    slug: "automod-and-chat-rules",
    title: "Set up AutoMod and chat rules for a new channel",
    excerpt: "Get the basics in place before your first raid: AutoMod level, blocked terms, and rules people can find.",
    summary: "Turn on AutoMod at level 2, add your own blocked terms, require verified emails for chat, and pin short rules in your panels.",
    category: "moderation",
    tags: ["automod", "mod-team"],
    authors: ["alex"],
    daysAgo: 128,
    difficulty: "beginner",
    estimatedMinutes: 20,
    prerequisites: ["Channel owner or editor access"],
    body: doc(p("All of this is in Creator Dashboard, Settings, Moderation. It takes 20 minutes and saves you a lot of awkward moments.")),
    sections: [
      { title: "Turn on AutoMod", body: doc(p("Start at level 2. It holds the clearly bad stuff for review and lets normal banter through. Raise it if you get a lot of hate raids.")) },
      { title: "Add blocked terms", body: doc(p("Add words and phrases specific to your community, like a running joke that's turned mean. Use permitted terms for names AutoMod keeps catching.")) },
      { title: "Lock down new accounts", body: doc(ul(["Require a verified email to chat.", "Turn on a follower-only delay of 10 minutes if you get drive-by spam."])) },
      { title: "Write rules people can find", body: doc(p("Five short rules in a panel and in your Discord. Your mods enforce what's written, so write what you mean.")) },
    ],
  },
  {
    type: "guide",
    slug: "first-sponsor-pitch",
    title: "Get ready for your first sponsor pitch",
    excerpt: "What brands look for, the numbers to have ready, and a pitch email short enough to get read.",
    summary: "Know your average viewers, hours streamed and audience regions. Make a one-page media kit. Pitch brands you already use, with one concrete idea.",
    category: "monetization",
    tags: ["sponsorships"],
    authors: ["robin"],
    daysAgo: 150,
    difficulty: "intermediate",
    estimatedMinutes: 30,
    prerequisites: ["A month of stream stats", "A clear niche or main game"],
    body: doc(p("Brands don't only want big numbers. They want an audience that fits and a streamer who shows up on time.")),
    sections: [
      { title: "Gather your numbers", body: doc(ul(["Average and peak viewers over the last 30 days.", "Hours streamed per week.", "Top countries and languages of your viewers."])) },
      { title: "Make a one-page media kit", body: doc(p("Who you are, what you stream, your numbers, and two or three examples of past partnerships or community events. One page, as a PDF.")) },
      { title: "Write the pitch", body: doc(p("Pitch brands you already use. Open with one concrete idea, like a giveaway during a themed stream. Keep it under 150 words."), callout("tip", "Follow up once after a week. After that, move on.")) },
      { title: "Agree on terms", body: doc(p("Get the deliverables, dates, payment and disclosure rules in writing before you mention the brand on stream.")) },
    ],
  },
];

export const MOCK_CONTENT: MockContent[] = [...MOCK_POSTS, ...MOCK_GUIDES];
