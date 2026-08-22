"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { FaGithub } from "react-icons/fa";
import { Scissors } from "lucide-react";
import TwitchLogin from "@/components/buttons/twitch-login";
import { githubLink } from "@/lib/constant";
import { LiveBadge } from "@/components/public/signal/live-badge";
import { DemoDataTag, EdgeStat, useDemoLinkStats } from "@/components/public/signal/stats";

/*
 * Prototype variant: The Chat Rail. The hero is a stream moment with chat as
 * witness: headline and actions live in the video pane, an object-grade chat
 * rail runs the right edge, and one message is lifted out of the flow as a
 * clip. All chat content is synthetic and labeled demo data.
 */

const NAME_COLORS = ["#ff7f50", "#1e90ff", "#00ff7f", "#9acd32", "#ff69b4", "#5f9ea0", "#daa520"];

interface ChatMessage {
  user: string;
  color: string;
  text: string;
  badge?: "mod" | "sub";
  clipped?: boolean;
}

const CHAT: ChatMessage[] = [
  { user: "pixel_dana", color: NAME_COLORS[0], text: "wait the overlay updates while you walk??" },
  { user: "irl_maik", color: NAME_COLORS[1], text: "3.4 km already lets gooo", badge: "sub" },
  { user: "notabot_kev", color: NAME_COLORS[2], text: "chat the bitrate did NOT drop on that tunnel" },
  { user: "mod_sanne", color: NAME_COLORS[3], text: "cloud obs carried that one", badge: "mod" },
  { user: "lurker_9000", color: NAME_COLORS[4], text: "CLIP THAT", clipped: true },
  { user: "pixel_dana", color: NAME_COLORS[0], text: "!clip" },
  { user: "twitchfan_iris", color: NAME_COLORS[5], text: "which widget is the map? link??" },
  { user: "mod_sanne", color: NAME_COLORS[3], text: "streamwizard.org, it's free and open source", badge: "mod" },
  { user: "notabot_kev", color: NAME_COLORS[2], text: "MIT licensed?? PogChamp" },
  { user: "irl_maik", color: NAME_COLORS[1], text: "star the repo chat", badge: "sub" },
];

function BadgeSquare({ kind }: { kind: "mod" | "sub" }) {
  return (
    <span
      aria-label={kind === "mod" ? "moderator" : "subscriber"}
      className={`mr-1.5 inline-block h-3.5 w-3.5 shrink-0 rounded-[3px] align-text-top ${
        kind === "mod" ? "bg-[#00ad03]" : "bg-[#9e7aff]"
      }`}
    />
  );
}

function ChatLine({ msg }: { msg: ChatMessage }) {
  return (
    <p className={`px-3 py-1 text-sm leading-snug ${msg.clipped ? "rounded-md bg-[#9e7aff]/15" : ""}`}>
      {msg.badge ? <BadgeSquare kind={msg.badge} /> : null}
      <span className="font-semibold" style={{ color: msg.color }}>
        {msg.user}
      </span>
      <span className="text-muted-foreground">: </span>
      <span className="text-foreground/90">{msg.text}</span>
    </p>
  );
}

export function ChatRailHero() {
  const { bitrateKbps } = useDemoLinkStats();
  const [sent, setSent] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  return (
    <section className="flex min-h-svh items-center py-10">
      <div className="container mx-auto px-4">
        <div className="grid overflow-hidden rounded-xl border border-border lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Video pane */}
          <div className="relative flex min-h-[480px] flex-col justify-end overflow-hidden bg-black p-6 md:p-10">
            <Image
              src="/img/landing-page/hero-dark.webp"
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 70vw, 100vw"
              className="pointer-events-none object-cover object-left-top opacity-20"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.85)_100%)]"
              aria-hidden="true"
            />

            <div className="absolute left-4 top-4 flex items-center gap-4 md:left-6 md:top-6">
              <LiveBadge />
              <span className="inline-flex items-center gap-2">
                <EdgeStat label="viewers" value="1,204" />
                <DemoDataTag />
              </span>
            </div>

            <div className="relative">
              <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                Your whole stream setup, in one open-source toolkit.
              </h1>
              <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
                Clips, overlays and analytics. Free forever, MIT-licensed, built in public.
              </p>

              {/* The lift: the clipped moment leaves the flow as a card. */}
              <div className="mt-6 inline-flex items-center gap-3 rounded-md border border-[#9e7aff]/60 bg-background/80 px-4 py-2.5">
                <Scissors className="h-4 w-4 text-[#9e7aff]" aria-hidden="true" />
                <span className="text-sm text-foreground/90">
                  Clip saved: <span className="font-medium">&ldquo;the tunnel did not win&rdquo;</span>
                </span>
                <DemoDataTag />
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <TwitchLogin redirect="/dashboard" text="Connect Twitch" variant="default" size="lg" source="hero-proto-chat" />
                <Link
                  href={githubLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-transparent px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                >
                  <FaGithub className="h-4 w-4" aria-hidden="true" />
                  Star on GitHub
                </Link>
              </div>

              <p className="mt-6 font-mono text-xs text-muted-foreground">
                <EdgeStat label="bitrate" value={bitrateKbps.toLocaleString("en-US")} unit="kb/s" />
              </p>
            </div>
          </div>

          {/* Chat rail */}
          <div className="flex max-h-[640px] flex-col border-t border-border bg-card lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Stream chat</span>
              <DemoDataTag />
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden" aria-hidden="true">
              <div className="proto-chat-scroll absolute inset-x-0">
                {[...CHAT, ...CHAT].map((msg, i) => (
                  <ChatLine key={`${msg.user}-${i}`} msg={msg} />
                ))}
              </div>
            </div>

            {sent.length > 0 ? (
              <div className="border-t border-border">
                {sent.slice(-3).map((text, i) => (
                  <ChatLine key={`sent-${i}`} msg={{ user: "you", color: "var(--foreground)", text }} />
                ))}
              </div>
            ) : null}

            <form
              className="border-t border-border p-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.trim()) return;
                setSent((s) => [...s, draft.trim()]);
                setDraft("");
              }}
            >
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Send a message"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e7aff]"
              />
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
