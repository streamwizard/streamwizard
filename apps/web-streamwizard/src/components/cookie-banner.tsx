"use client";

import Link from "next/link";
import { denyConsent, getConsentStatus, grantConsent, hasGlobalPrivacyControl } from "@repo/posthog";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { enableSentryReplay } from "@/lib/sentry-replay";

const content = {
  normal: {
    title: "🍪 We use cookies",
    sub: "Unlike your Twitch chat, we ask before we watch.",
    body: "We use PostHog to track page views and clicks. No ads, no selling your data, just us figuring out why nobody clicks that button.\n\nDecline and you still count as a +1 in the page stats. No cookies, no profile.\n\nSigned in? We still log what your account does, like making an overlay. No IP, and not for sale either.",
    accept: "PogChamp, let's go ✅",
    decline: "Nah, I'm lurking",
    more: "What we track",
    less: "Got it, hide this",
    acceptToast: { title: "PogChamp! 🎉", description: "You're now being watched. Just kidding. Kind of." },
    declineToast: { title: "👀 Lurk mode activated", description: "No cookies, no profile. Page stats stay anonymous. True lurker." },
  },
  genz: {
    title: "🍪 this website got cookies fr",
    sub: "powered by posthog bc we need to know when the ui is fighting for its life ☕️",
    body: "we track clicks + navigation + anonymous usage stuff so we can keep improving things instead of shipping pure chaos 💀\n\ndecline = no cookies, no profile. u still count as an anonymous +1 in the page stats tho, like a lurker in the view count.\n\nlogged in? we still note what ur account does (making an overlay etc). no IP tho.\n\nalso we do NOT sell ur data. that's loser behavior ngl.",
    accept: "it's giving consent ✅ slayyyyyyyyy",
    decline: "nah fam i'm ghosting 👻",
    more: "what we track",
    less: "ok hide it",
    acceptToast: { title: "slay! you're based 🔥", description: "tracking activated. we see u. in a chill way tho." },
    declineToast: { title: "ghost mode on fr 👻", description: "no cookies. no profile. page stats stay anonymous. certified lurker behavior." },
  },
} as const;

type Tab = keyof typeof content;

export function CookieBanner() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState<Tab>("normal");
  // Phones only: the long text and the voice switch stay folded away until
  // asked for, so the card does not cover the page. From sm up both always show.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (getConsentStatus() !== "pending") return;
    // The browser already answered for them. Same path as the Decline button,
    // recorded so we don't ask again; Cookie settings in the footer still
    // lets them change it.
    if (hasGlobalPrivacyControl()) {
      denyConsent("gpc");
      return;
    }
    setVisible(true);
  }, []);

  function accept() {
    grantConsent();
    void enableSentryReplay();
    setVisible(false);
    toast(content[tab].acceptToast.title, { description: content[tab].acceptToast.description });
  }

  function decline() {
    denyConsent("button");
    setVisible(false);
    toast(content[tab].declineToast.title, { description: content[tab].declineToast.description });
  }

  if (!mounted || !visible) return null;

  const c = content[tab];

  return (
    // Above every dialog, and clickable while one is open. A new user gets the
    // onboarding wizard on their first page, and it is a modal: it sat on top
    // of this banner (same z-index, later in the DOM) and switched off pointer
    // events for everything outside itself, so the question could not be
    // answered until onboarding was done. z-[60] puts the banner over the
    // dialog and its backdrop; pointer-events-auto opts it back in.
    <div className="pointer-events-auto fixed inset-x-3 bottom-3 z-[60] animate-in slide-in-from-bottom-4 duration-300 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-full sm:max-w-sm">
      <div className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Tabs */}
        <div id="cookie-banner-tabs" className={`${open ? "flex" : "hidden"} border-b border-border sm:flex`}>
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

        <div className="p-4 sm:p-5">
          <p className="text-base font-semibold text-foreground mb-1">{c.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{c.sub}</p>
          <p
            id="cookie-banner-details"
            className={`${open ? "block" : "hidden"} mt-1 max-h-[40vh] overflow-y-auto text-xs text-muted-foreground leading-relaxed whitespace-pre-line sm:block sm:max-h-none sm:overflow-visible`}
          >
            {c.body}
          </p>

          <div className="mt-3 flex gap-2 sm:mt-4">
            <button
              onClick={accept}
              className="flex-1 rounded-lg bg-primary px-3 py-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 cursor-pointer sm:py-2"
            >
              {c.accept}
            </button>
            <button
              onClick={decline}
              className="flex-1 rounded-lg border border-border px-3 py-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer sm:py-2"
            >
              {c.decline}
            </button>
          </div>

          {/* The after: box is the tap area. It reaches past the small text
              without moving anything around it. */}
          <p className="mt-3 text-center text-[11px] text-muted-foreground/80 sm:text-[10px] sm:text-muted-foreground/60">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="cookie-banner-tabs cookie-banner-details"
              className="relative inline-flex items-center gap-1 underline underline-offset-2 hover:text-muted-foreground transition-colors cursor-pointer after:absolute after:inset-x-0 after:-inset-y-2 sm:hidden"
            >
              {open ? c.less : c.more}
              <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            <span className="sm:hidden">{" · "}</span>
            <Link
              href="/privacy-policy"
              className="relative inline-block underline underline-offset-2 hover:text-muted-foreground transition-colors after:absolute after:inset-x-0 after:-inset-y-2"
            >
              Privacy policy
            </Link>
            <span className="hidden sm:inline">{" · "}</span>
            <span className={`${open ? "block" : "hidden"} mt-2 sm:mt-0 sm:inline`}>
              Change your mind any time via Cookie settings in the footer.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
