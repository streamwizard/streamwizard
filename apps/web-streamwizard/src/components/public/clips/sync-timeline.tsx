"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useInView, useReducedMotion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { cn } from "@repo/ui";

/*
 * Auto-playing vignette for the sync section, on loop: a live stream with
 * chat clipping away, a check every few minutes that files the new clips
 * while the badge still says Live, the stream ends, and one last pass
 * settles the view counts. No controls and no real data; the point is that
 * clips arrive before the stream is over.
 *
 * State is the step index rather than the phase, since live and pull each
 * play twice. The loop starts on the finished frame so the server render
 * and reduced-motion visitors get the full grid with its verdict line, and
 * the timer only runs in view. Chat rides a monotonic tick so re-entering a
 * live step never needs a state reset (react-compiler: no setState in
 * effect bodies, only in timer callbacks).
 */

type Phase = "live" | "pull" | "offline" | "tidy" | "done";

type Step = { phase: Phase; hold: number; revealed: number };

const SCRIPT: Step[] = [
  { phase: "live", hold: 3200, revealed: 0 },
  { phase: "pull", hold: 1800, revealed: 2 },
  { phase: "live", hold: 3200, revealed: 2 },
  { phase: "pull", hold: 1800, revealed: 4 },
  { phase: "offline", hold: 1400, revealed: 4 },
  { phase: "tidy", hold: 2200, revealed: 6 },
  { phase: "done", hold: 4200, revealed: 6 },
];
const LAST_STEP = SCRIPT.length - 1;
const CHAT_TICK_MS = 850;
const CLIPS_PER_CHECK = 2;

const CHAT_MESSAGES = [
  "CLIP IT CLIP IT",
  "LMAOOO",
  "NO WAY",
  "W",
  "THE 1V5???",
  "clip that someone",
  "HE'S CRACKED",
  "chat did you see that",
];

// views: [right after the clip is made, after the last pass]. Twitch counts
// settle late, which is what the end-of-stream pass is for.
const CLIPS = [
  { title: "the 1v5", tint: "from-cyan-500/40", views: [12, 148] },
  { title: "chat??", tint: "from-purple-500/40", views: [4, 61] },
  { title: "NO WAY", tint: "from-rose-500/40", views: [9, 203] },
  { title: "clutch", tint: "from-sky-500/40", views: [2, 77] },
  { title: "the fall", tint: "from-emerald-500/40", views: [0, 39] },
  { title: "??? lol", tint: "from-orange-500/40", views: [0, 24] },
];

const STATUS: Record<Phase, string> = {
  live: "Live. Chat is clipping.",
  pull: `Checked Twitch. ${CLIPS_PER_CHECK} new clips filed.`,
  offline: "Stream ended.",
  tidy: "Last pass: view counts and VOD timestamps.",
  done: `${CLIPS.length} clips, all from tonight.`,
};

const PILL: Partial<Record<Phase, string>> = {
  pull: `+${CLIPS_PER_CHECK}`,
  tidy: `+${CLIPS_PER_CHECK}`,
  done: String(CLIPS.length),
};

export function SyncTimeline() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { margin: "-64px" });
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(LAST_STEP);
  const [tick, setTick] = useState(0);

  const { phase, hold, revealed } = SCRIPT[step] as Step;

  useEffect(() => {
    if (!inView || reducedMotion) return;
    const timer = setTimeout(() => setStep((s) => (s + 1) % SCRIPT.length), hold);
    return () => clearTimeout(timer);
  }, [step, hold, inView, reducedMotion]);

  useEffect(() => {
    if (phase !== "live") return;
    const interval = setInterval(() => setTick((t) => t + 1), CHAT_TICK_MS);
    return () => clearInterval(interval);
  }, [phase, step]);

  // Live through both checks: that is the whole message.
  const live = phase === "live" || phase === "pull";
  const checking = phase === "pull" || phase === "tidy";
  const settled = phase === "tidy" || phase === "done";
  const pill = PILL[phase];

  const chat = live
    ? [tick - 2, tick - 1, tick]
        .filter((n) => n >= 0)
        .map((n) => ({ id: n, text: CHAT_MESSAGES[n % CHAT_MESSAGES.length] }))
    : [];

  // The bar is "time until the next check": it fills over a live step and
  // over the last pass, sits full while a check runs, and drops once the
  // stream ends.
  const barTarget =
    phase === "live" || phase === "tidy" ? { scaleX: [0, 1] } : phase === "offline" ? { scaleX: 0 } : { scaleX: 1 };
  const barTransition =
    phase === "live" || phase === "tidy" ? { duration: hold / 1000, ease: "easeInOut" as const } : { duration: 0.3 };

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={rootRef}
        className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6"
        aria-label="Animation: chat clips a live stream, StreamWizard files the new clips every few minutes while the stream is still live, then runs one last pass when it ends"
      >
        {/* The live badge is the trigger for everything below. */}
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            auto check · every 5 min
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest transition-colors duration-500",
              live
                ? "border-red-500/40 bg-red-500/10 text-red-300"
                : "border-white/[0.08] bg-white/[0.03] text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full transition-colors duration-500",
                live ? "animate-pulse bg-red-400" : "bg-zinc-500",
              )}
            />
            {live ? "Live" : "Offline"}
          </span>
        </div>

        {/* Stream preview: glowing while live, dark once it ends. Chat
            bubbles float over it. */}
        <div className="relative mt-4 overflow-hidden rounded-xl border border-white/[0.08]">
          <div
            className={cn(
              "aspect-[16/7] transition-colors duration-700",
              live ? "bg-gradient-to-br from-purple-500/25 via-fuchsia-500/10 to-black/60" : "bg-black/50",
            )}
          />
          <motion.div
            className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-purple-400/15 to-transparent"
            animate={live ? { opacity: [0.3, 0.8, 0.3] } : { opacity: 0 }}
            transition={live ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.5 }}
            aria-hidden="true"
          />
          <AnimatePresence>
            {!live && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 flex items-center justify-center font-mono text-xs uppercase tracking-widest text-muted-foreground"
              >
                Offline
              </motion.p>
            )}
          </AnimatePresence>

          <div className="absolute bottom-2 left-2 flex flex-col items-start gap-1">
            <AnimatePresence initial={false} mode="popLayout">
              {chat.map(({ id, text }) => (
                <motion.span
                  key={id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-md bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white/80"
                >
                  {text}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex h-5 items-center gap-2" aria-live="polite">
            <RefreshCw
              className={cn(
                "size-3.5 text-purple-400 transition-opacity duration-300",
                checking ? "animate-spin opacity-100" : "opacity-0",
              )}
              aria-hidden="true"
            />
            <motion.p
              key={step}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={cn("text-sm", phase === "done" ? "text-purple-200" : "text-muted-foreground")}
            >
              {STATUS[phase]}
            </motion.p>
            <AnimatePresence>
              {pill && (
                <motion.span
                  key={step}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 18 }}
                  className="rounded-full border border-purple-400/30 bg-purple-400/[0.08] px-2 py-px font-mono text-[10px] text-purple-300"
                >
                  {pill}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
            <motion.div
              className="h-full origin-left rounded-full bg-purple-400/70"
              initial={false}
              animate={barTarget}
              transition={barTransition}
            />
          </div>
        </div>

        {/* Library slots: skeletons that shimmer while a check runs, then
            the clips spring in over them, two per check. Cards already in
            the library swap to their settled view count on the last pass. */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {CLIPS.map(({ title, tint, views }, i) => {
            const shown = i < revealed;
            const count = settled ? views[1] : views[0];
            return (
              <div key={title} className="relative overflow-hidden rounded-lg border border-white/[0.08]">
                <motion.div
                  animate={checking && !shown ? { opacity: [0.4, 1, 0.4] } : { opacity: 1 }}
                  transition={
                    checking && !shown
                      ? { duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: (i % 3) * 0.12 }
                      : { duration: 0.3 }
                  }
                  aria-hidden="true"
                >
                  <div className="aspect-video bg-white/[0.03]" />
                  <div className="border-t border-white/[0.08] bg-black/30 px-2 py-1">
                    <div className="h-3.5 w-10 rounded bg-white/[0.06]" />
                  </div>
                </motion.div>
                <motion.div
                  initial={false}
                  animate={shown ? "visible" : "hidden"}
                  variants={{
                    hidden: { opacity: 0, scale: 0.85, y: 14, transition: { duration: 0.25 } },
                    visible: {
                      opacity: 1,
                      scale: 1,
                      y: 0,
                      // Let the spinner turn for a beat before the clip lands.
                      transition: { type: "spring", stiffness: 260, damping: 20, delay: 0.45 + (i % CLIPS_PER_CHECK) * 0.12 },
                    },
                  }}
                  className="absolute inset-0"
                >
                  <div className={cn("aspect-video bg-gradient-to-br to-black/60", tint)} />
                  <div className="flex items-center justify-between gap-1 border-t border-white/[0.08] bg-black/30 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                    <p className="truncate">{title}</p>
                    <AnimatePresence initial={false} mode="wait">
                      <motion.span
                        key={settled ? "settled" : "fresh"}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="shrink-0 tabular-nums"
                      >
                        {count} views
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </MotionConfig>
  );
}
