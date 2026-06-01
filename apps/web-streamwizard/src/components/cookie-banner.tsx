"use client";

import { initPostHog } from "@repo/posthog";
import Link from "next/link";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const CONSENT_KEY = "sw_cookie_consent";

const content = {
  normal: {
    title: "🍪 We use cookies",
    sub: "Unlike your Twitch chat, we ask before we watch.",
    body: "We use PostHog to track page views and clicks — no ads, no selling your data, just us figuring out why nobody clicks that button. Session replay is included, but we promise not to clip your embarrassing moments.",
    accept: "PogChamp, let's go ✅",
    decline: "Nah, I'm lurking",
    acceptToast: { title: "PogChamp! 🎉", description: "You're now being watched. Just kidding. Kind of." },
    declineToast: { title: "👀 Lurk mode activated", description: "No tracking. No data. You are a ghost. We respect it." },
  },
  genz: {
    title: "🍪 this website got cookies fr",
    sub: "powered by posthog bc we need to know when the ui is fighting for its life ☕️",
    body: "we track clicks + navigation + anonymous usage stuff so we can keep improving things instead of shipping pure chaos 💀\n\nyes there's session replay. no there's not a dude watching u scroll at 2am like netflix.\n\nalso we do NOT sell ur data. that's loser behavior ngl.",
    accept: "it's giving consent ✅ slayyyyyyyyy",
    decline: "nah fam i'm ghosting 👻",
    acceptToast: { title: "slay! you're based 🔥", description: "tracking activated. we see u. in a chill way tho." },
    declineToast: { title: "ghost mode on fr 👻", description: "no data. no tracking. you're literally invisible rn." },
  },
} as const;

type Tab = keyof typeof content;

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState<Tab>("normal");

  useEffect(() => {
    if (!localStorage.getItem(CONSENT_KEY)) {
      setVisible(true);
    }
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, "accepted");
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      initPostHog({
        key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      });
    }
    posthog.opt_in_capturing();
    setVisible(false);
    toast(content[tab].acceptToast.title, { description: content[tab].acceptToast.description });
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, "declined");
    posthog.opt_out_capturing();
    setVisible(false);
    toast(content[tab].declineToast.title, { description: content[tab].declineToast.description });
  }

  if (!visible) return null;

  const c = content[tab];

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full animate-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-border">
          {(["normal", "genz"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-3 py-2 text-[11px] font-medium transition-colors cursor-pointer ${
                tab === t
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "normal" ? "Normal" : "Gen-Z version ✨"}
            </button>
          ))}
        </div>

        <div className="p-5">
          <p className="text-base font-semibold text-foreground mb-1">{c.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-1">{c.sub}</p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4 whitespace-pre-line">{c.body}</p>

          <div className="flex gap-2">
            <button
              onClick={accept}
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 cursor-pointer"
            >
              {c.accept}
            </button>
            <button
              onClick={decline}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
            >
              {c.decline}
            </button>
          </div>

          <p className="mt-3 text-center text-[10px] text-muted-foreground/60">
            <Link href="/privacy" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">
              Privacy policy
            </Link>
            {" · "}
            You can change this any time in your browser settings.
          </p>
        </div>
      </div>
    </div>
  );
}
