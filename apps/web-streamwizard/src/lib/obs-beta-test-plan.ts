// Cloud OBS beta test plan rendered by /dashboard/irl/beta-test.
// Answers are stored in obs_beta_feedback keyed by these ids, so treat ids as
// stable: never reuse or renumber one, only append.

export const RESULT_OPTIONS = [
  { value: "pass", label: "Pass" },
  { value: "fail", label: "Fail" },
  { value: "partial", label: "Partial" },
  { value: "blocked", label: "Blocked" },
  { value: "skipped", label: "Skipped" },
] as const;

export type ResultValue = (typeof RESULT_OPTIONS)[number]["value"];

export interface BetaTestCase {
  id: string;
  action: string;
  expected: string;
  needsLiveSignal?: boolean;
}

export interface BetaTestSection {
  id: string;
  title: string;
  intro?: string;
  cases: BetaTestCase[];
}

export interface TesterInfoField {
  id: string;
  label: string;
  placeholder: string;
}

export interface OpenQuestion {
  id: string;
  label: string;
  placeholder?: string;
}

export const TESTER_INFO_FIELDS: TesterInfoField[] = [
  { id: "browser", label: "Browser and version", placeholder: "Chrome 126" },
  { id: "os", label: "Operating system", placeholder: "Windows 11 / macOS / Android" },
  { id: "device", label: "Device", placeholder: "Desktop, laptop, phone" },
  { id: "hardware", label: "Streaming hardware", placeholder: "Belabox, Moblin, IRL Pro, local OBS, none" },
  { id: "connection", label: "Internet connection", placeholder: "Wifi, ethernet, bonded 4G/5G" },
];

export const BETA_TEST_SECTIONS: BetaTestSection[] = [
  {
    id: "setup",
    title: "First-run setup",
    intro:
      "This only shows on a fresh account with no cloud instance and no ingest key. Already set up? Ask us to reset your account, or skip to the next section.",
    cases: [
      {
        id: "1.1",
        action: "Go to Dashboard, IRL, Cloud OBS with a fresh account.",
        expected:
          'A guided setup titled "Set up your IRL stream" with 5 numbered steps. Only step 1 is active, later steps look locked.',
      },
      {
        id: "1.2",
        action: 'Step 1: type a label (like "Belabox") and click Create key.',
        expected: "A success message, step 1 gets a checkmark, step 2 unlocks.",
      },
      {
        id: "1.3",
        action: "Step 2: click Launch Cloud OBS.",
        expected: "The button shows it's working, then step 3 starts automatically. No confusing errors.",
      },
      {
        id: "1.4",
        action: "Step 3: wait while OBS boots (should be 10 to 30 seconds). Time it.",
        expected: "A booting spinner, then the step completes on its own. Put the actual boot time in your notes.",
      },
      {
        id: "1.5",
        action: "Step 4: add an alert widget (StreamElements / Streamlabs / SoundAlerts URL) or click Skip.",
        expected: "Adding confirms and moves on. Skipping goes straight to step 5.",
      },
      {
        id: "1.6",
        action: "Step 5: click Open OBS.",
        expected: "A popup opens showing the OBS desktop, and the setup screen is replaced by the normal dashboard.",
      },
      {
        id: "1.7",
        action: "Overall: was the setup clear? Did you ever wonder what to do next?",
        expected: "Opinion question. Anything confusing or badly worded goes in the notes.",
      },
    ],
  },
  {
    id: "lifecycle",
    title: "Starting, stopping and the instance lifecycle",
    cases: [
      {
        id: "2.1",
        action: "Look at the preview tile at the top while OBS is running.",
        expected: "A live preview with a LIVE badge. Clicking it opens the fullscreen viewer popup.",
      },
      {
        id: "2.2",
        action: "Click Stop container.",
        expected: 'Status goes to stopping, then Offline. A "Container stopped" message. The preview goes offline.',
      },
      {
        id: "2.3",
        action: "Click Start container and watch the boot progress.",
        expected: "Staged progress (Provisioning, Booting OBS, Ready to stream) with a seconds counter. Ends connected.",
      },
      {
        id: "2.4",
        action: "Start and stop the container 3 or 4 times in a row.",
        expected: "Works every time. No stuck states, no double toasts, buttons disable while busy.",
      },
      {
        id: "2.5",
        action: "While OBS is connected, reload the page.",
        expected: "Correct status comes back quickly. No lingering fake offline state.",
      },
      {
        id: "2.6",
        action: "Open this page in two tabs. Stop the container from tab A while watching tab B.",
        expected: "Tab B updates on its own and shows a shutdown notification without you clicking anything there.",
      },
      {
        id: "2.7",
        action: "If OBS crashes during testing (or ask us to crash it for you).",
        expected:
          "A red sticky banner with a Restart button. It stays until you dismiss it or restart, it doesn't vanish after a few seconds.",
      },
      {
        id: "2.8",
        action: "Watch the status badge through your whole session.",
        expected: "Statuses always matched reality. Note any moment the badge said one thing while reality was another.",
      },
    ],
  },
  {
    id: "ingest",
    title: "Ingest keys",
    intro: "All of this lives on Dashboard, IRL, Ingest.",
    cases: [
      {
        id: "3.1",
        action: "Look at the connection URLs for your key.",
        expected: "An SRT URL and SRTLA details (host, port 5000, streamid), each with a working copy button.",
      },
      {
        id: "3.2",
        action: "Paste the SRT or SRTLA settings into your encoder and start streaming.",
        expected: "Your encoder connects on the first try using exactly what the page shows.",
        needsLiveSignal: true,
      },
      {
        id: "3.3",
        action: "While streaming, watch the live status at the top.",
        expected:
          "Within a few seconds: a quality badge (good / unstable / poor) plus bitrate, RTT, packet loss and bandwidth numbers that keep updating and look believable.",
        needsLiveSignal: true,
      },
      {
        id: "3.4",
        action: "Stop the encoder.",
        expected: 'Within about 10 seconds the page shows "No active stream right now" instead of frozen numbers.',
        needsLiveSignal: true,
      },
      {
        id: "3.5",
        action: "Try to create a second ingest key.",
        expected: 'It refuses with "You\'ve already got an ingest key. Rotate it instead."',
      },
      {
        id: "3.6",
        action: "Click the Discord icon on your key (link Discord in Settings, Integrations first).",
        expected: "A DM from the bot with your key blurred, plus a Manage keys button. The page confirms it sent.",
      },
      {
        id: "3.7",
        action: "Unlink Discord and click the Discord icon again.",
        expected: 'A clear error: "Connect Discord in Settings → Integrations first." Not a silent failure.',
      },
      {
        id: "3.8",
        action: "Rotate your key, then try streaming with the old key.",
        expected: "The old key is really dead. Your encoder fails to connect until you paste the new one.",
        needsLiveSignal: true,
      },
      {
        id: "3.9",
        action: 'Check the "last used" timestamp after streaming.',
        expected: 'A recent, sensible time. Not "Never used" after you clearly streamed.',
      },
      {
        id: "3.10",
        action: "Click Delete on the key.",
        expected:
          "A confirmation warns that encoders using it stop immediately. Cancel works, confirming really deletes it.",
      },
    ],
  },
  {
    id: "scenes",
    title: "Scenes, going live and ingest into scenes",
    cases: [
      {
        id: "4.1",
        action: "With OBS connected, look at the Scenes card.",
        expected: "Your scenes as buttons, active one has a green dot. Internal scenes (starting with _ or -) are hidden.",
      },
      {
        id: "4.2",
        action: "Click a different scene and check the fullscreen viewer.",
        expected: 'A brief "Switching…" state, then the new scene is active in both the dashboard and OBS itself.',
      },
      {
        id: "4.3",
        action: "Click Add source next to your key, pick a scene, confirm.",
        expected:
          "A dialog with a pre-filled source name and scene picker. After confirming: a green badge and the source really exists in that OBS scene.",
      },
      {
        id: "4.4",
        action: "Start your encoder and check the scene with the ingest source.",
        expected: "Your camera feed shows up in that scene within a few seconds.",
        needsLiveSignal: true,
      },
      {
        id: "4.5",
        action: "Click Go live (heads up: this streams to your real channel). Then Stop stream.",
        expected: 'The badge flips to "Streaming" and your channel really goes live. Stopping works the same way.',
      },
      {
        id: "4.6",
        action: "Time the delay from clicking Go live to your channel actually being live.",
        expected: "Put the delay and the platform in your notes.",
      },
    ],
  },
  {
    id: "profiler",
    title: "Sources and Performance tabs",
    cases: [
      {
        id: "5.1",
        action: "Open the Sources tab and expand a scene.",
        expected: "A tree of scenes, sources and filters with CPU/GPU/total % bars. Heavy items show amber or red.",
      },
      {
        id: "5.2",
        action: "Use the search box and the sort dropdown.",
        expected: "Search filters instantly, sorting by CPU/GPU/name reorders correctly.",
      },
      {
        id: "5.3",
        action: "Toggle a source off with its switch, check OBS, toggle it back on.",
        expected: "The source disappears and reappears in the OBS scene in real time.",
      },
      {
        id: "5.4",
        action: "Open the Performance tab and leave it for 2 minutes.",
        expected: "Live charts for CPU, RAM, FPS and frame time that update smoothly with plausible numbers.",
      },
    ],
  },
  {
    id: "files",
    title: "File manager (Files tab)",
    cases: [
      {
        id: "6.1",
        action: "Open the Files tab while the instance is running.",
        expected: 'A storage usage bar (used / total) and your files, or a "No files yet." message.',
      },
      {
        id: "6.2",
        action: "Drag and drop a PNG or JPG.",
        expected: "Per-file progress, an uploaded confirmation, the file in the list, storage bar goes up.",
      },
      {
        id: "6.3",
        action: "Upload an mp4 via click-to-browse.",
        expected: "Same as above. Note the file size and upload time.",
      },
      {
        id: "6.4",
        action: "Upload 3 or more files at once.",
        expected: "Each shows its own progress, all complete, none silently missing.",
      },
      {
        id: "6.5",
        action: "Try weird uploads: a multi-GB file, a .exe or .zip, a filename with emoji or spaces.",
        expected:
          "Anything the server refuses fails with a clear error, not a hang. Note exactly which files failed and what the error said.",
      },
      {
        id: "6.6",
        action: "Use an uploaded file as a media source in OBS, then rename the file here.",
        expected:
          "Rename works and warns that scenes using the file need their source updated. Check what actually happened in OBS.",
      },
      {
        id: "6.7",
        action: "Delete a file.",
        expected: "A confirmation first. After confirming, the file is gone and the storage bar goes down.",
      },
      {
        id: "6.8",
        action: "Stop the container, then open the Files tab.",
        expected: "A friendly message that files need a running instance. Not an error or infinite spinner.",
      },
      {
        id: "6.9",
        action: "If you can: fill storage close to the quota and try one more upload.",
        expected: "A clear quota error, nothing corrupted.",
      },
    ],
  },
  {
    id: "auto-switcher",
    title: "Auto Switcher",
    intro:
      "The auto switcher watches your incoming signal (bitrate, ping, packet loss) and switches OBS scenes when it degrades or drops, then switches back on recovery. Most tests here need a live signal you can break on purpose: walk out of wifi range, toggle airplane mode, cap your bitrate.",
    cases: [
      {
        id: "7.1",
        action: "Open the Auto Switcher tab and turn the master switch on.",
        expected: "The config form appears: scene model (2 or 3 scenes), scene pickers, sensitivity presets.",
      },
      {
        id: "7.2",
        action: "Try to save with no scenes selected.",
        expected: "Validation stops you and says which scenes are required. It won't save a broken config.",
      },
      {
        id: "7.3",
        action: "Pick 2-scene mode with Balanced sensitivity and save. Then reload the page.",
        expected: "A saved confirmation, and the settings survive the reload.",
      },
      {
        id: "7.4",
        action: "Switch to 3-scene mode.",
        expected: "A third scene picker appears and is required before saving.",
      },
      {
        id: "7.5",
        action: "Start streaming and watch the live status card.",
        expected: '"Checking signal" during startup, then Live. Progress bars for bitrate/RTT/loss make sense.',
        needsLiveSignal: true,
      },
      {
        id: "7.6",
        action: "Degrade your connection on purpose.",
        expected:
          'Status shows "Low quality", the bars fill toward the trigger, and OBS switches scenes. Note how many seconds it took.',
        needsLiveSignal: true,
      },
      {
        id: "7.7",
        action: "Restore your connection.",
        expected: "Recovery progress, then it switches back to your Live scene. Note the recovery time.",
        needsLiveSignal: true,
      },
      {
        id: "7.8",
        action: "Kill the signal completely.",
        expected:
          'It switches to your Connection-lost scene and shows "Signal lost". With auto-stop enabled, a countdown appears.',
        needsLiveSignal: true,
      },
      {
        id: "7.9",
        action: "Check the last-switch info after a few switches.",
        expected: "From-scene, to-scene and a readable reason that matches what actually happened.",
      },
      {
        id: "7.10",
        action: "Hold a scene for 15 minutes, then degrade your signal on purpose.",
        expected:
          'Status shows "Held by you" with a countdown and it never switches away. Release resumes automatic switching.',
        needsLiveSignal: true,
      },
      {
        id: "7.11",
        action: "Enable Twitch chat messages, customize a template with {bitrate}, force a switch.",
        expected: "The bot posts your message in chat with real values filled in.",
        needsLiveSignal: true,
      },
      {
        id: "7.12",
        action: "Enable the warning source option, pick a source, then degrade the signal.",
        expected: "The chosen source appears in the Live scene shortly before the full switch.",
        needsLiveSignal: true,
      },
      {
        id: "7.13",
        action: "Enable auto-stop with 1 minute, kill your signal and wait. Also try entering 0 and 500 minutes.",
        expected: "After the countdown the stream output really stops. Values outside 1 to 120 are rejected.",
        needsLiveSignal: true,
      },
      {
        id: "7.14",
        action: "Turn on Advanced mode and look at the threshold table.",
        expected: "Understandable, saves, and persists after reload. Be honest in the notes: would you dare touch these?",
      },
      {
        id: "7.15",
        action: "Delete or rename a configured scene inside OBS, then reopen the config form.",
        expected: "A clear warning that the saved scene no longer exists. No crash.",
      },
    ],
  },
  {
    id: "alerts",
    title: "Alert sources",
    cases: [
      {
        id: "8.1",
        action: 'Add an alert widget with a real URL, and tick an extra scene under "Also show it in". Fire a test alert.',
        expected: "The widget lands in the alerts scene plus the extra scene, and the test alert shows on stream.",
      },
      {
        id: "8.2",
        action: "Try adding the same widget twice.",
        expected: "The page shows it's already there instead of blindly duplicating.",
      },
      {
        id: "8.3",
        action: "Read the copy in this form, including the double-audio warning and the Overlay Editor link.",
        expected: "The link works. Was the double-audio warning understandable? Notes please.",
      },
    ],
  },
  {
    id: "viewer",
    title: "Fullscreen OBS viewer",
    cases: [
      {
        id: "9.1",
        action: "Use OBS in the viewer for a few minutes: move sources, open settings, type in a text source.",
        expected: "Behaves like a remote desktop. Clicks land where you aim, typing works, latency is tolerable.",
      },
      {
        id: "9.2",
        action: "Switch to another tab for a minute, then come back.",
        expected: "It reconnects by itself within a few seconds. No permanent black screen.",
      },
      {
        id: "9.3",
        action: "Briefly cut your own internet while the viewer is open.",
        expected: "A disconnected state, then automatic recovery once you're back online (it retries for about 90 seconds).",
      },
      {
        id: "9.4",
        action: "Stop the container while the viewer is open.",
        expected: "A sensible disconnected state. Not a frozen last frame that looks alive.",
      },
      {
        id: "9.5",
        action: "Leave the viewer open for 30+ minutes.",
        expected: "No creeping slowdown or dropped session. Note your browser and how long.",
      },
    ],
  },
  {
    id: "gps",
    title: "GPS and location",
    intro: "Lives on Dashboard, IRL, GPS. You'll need a phone.",
    cases: [
      {
        id: "10.1",
        action: "Create a device link and copy the URL.",
        expected: 'A link with a copy confirmation, and the device shows up under "Your devices".',
      },
      {
        id: "10.2",
        action: "Open the link on your phone and allow location.",
        expected: "The live map starts showing your position within a reasonable time.",
      },
      {
        id: "10.3",
        action: "Test indoors first, then move around outdoors.",
        expected: "Indoors you may get a poor-accuracy warning. Outdoors the position tracks your movement believably.",
      },
      {
        id: "10.4",
        action: "Add a GPS overlay widget (Speed, Heading, Altitude) and check it while moving.",
        expected: "The overlay values update and roughly match reality.",
      },
      {
        id: "10.5",
        action: "Remove the device.",
        expected: "A confirmation first. After removing, the map stops updating.",
      },
    ],
  },
];

export const OPEN_QUESTIONS: OpenQuestion[] = [
  {
    id: "real_stream",
    label: "The real test: do an actual IRL stream (even 30 minutes). How long, on what hardware, to which platform?",
  },
  {
    id: "stability",
    label: "Did the stream stay up the whole time? Any drops, freezes or audio desync, and when?",
  },
  { id: "quality", label: "How was the output quality for viewers? Ask them." },
  { id: "switcher_real", label: "Did the auto switcher behave the way you wanted during real signal dips?" },
  { id: "mobile", label: "Could you manage everything from your phone while out? What was hard on mobile?" },
  { id: "confusing", label: "What was the most confusing part of the whole experience?" },
  { id: "broken", label: "What broke that isn't covered by a test above?" },
  { id: "missing", label: "What's missing before you'd use this for your real streams?" },
  { id: "comparison", label: "How does it compare to what you use today (IRLToolkit, local OBS, other)?" },
  { id: "score", label: "1 to 10: would you recommend Cloud OBS to another IRL streamer? Why?" },
];

export const TOTAL_CASES = BETA_TEST_SECTIONS.reduce((n, s) => n + s.cases.length, 0);
