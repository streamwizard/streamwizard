import Link from "next/link";
import { ArrowRight, Download, FolderTree, Scissors, Search } from "lucide-react";
import { docsClipsLink } from "@/lib/constant";
import { getShowcaseClips } from "@/lib/showcase-clips";
import { Reveal } from "./reveal";
import { ClipsMarquee } from "./clips-marquee";

/*
 * Full-bleed band: the marquee escapes the container while the copy stays in
 * it. Amber is the product's clip color, reused here as the section accent.
 */

const features = [
  {
    icon: Search,
    title: "Search that works",
    body: "Free text, category, who clipped it, date range, featured only. Sort by views or date.",
  },
  {
    icon: FolderTree,
    title: "Clip folders you create",
    body: "Sort clips by game, meme format, or vibe, with folders inside folders. Twitch dumps them in one pile; you do not have to.",
  },
  {
    icon: Scissors,
    title: "Cut from the VOD",
    body: "Scrub the timeline, drag a selection, make a clip. Event markers show where the action was.",
  },
  {
    icon: Download,
    title: "Landscape and portrait",
    body: "Download the portrait cut for Shorts and TikTok without opening an editor.",
  },
];

function VodTimelineStrip() {
  return (
    <div
      className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"
      role="img"
      aria-label="Sketch of the VOD timeline: event markers for follows, subs, and clips, plus a dragged selection for a new clip"
    >
      <div aria-hidden="true">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>VOD timeline</span>
          <span>4:12:00</span>
        </div>
        <div className="relative mt-3 h-10 rounded-md border border-white/[0.07] bg-white/[0.04]">
          {/* Played portion */}
          <div className="absolute inset-y-0 left-0 w-[62%] rounded-l-md bg-purple-500/15" />
          {/* Muted segment */}
          <div
            className="absolute inset-y-0 left-[30%] w-[7%] rounded-sm opacity-60"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,0.14) 0 4px, transparent 4px 8px)",
            }}
          />
          {/* Event markers */}
          <span className="absolute top-0 left-[13%] h-full w-0.5 bg-green-500/80" />
          <span className="absolute top-0 left-[28%] h-full w-0.5 bg-green-500/80" />
          <span className="absolute top-0 left-[36%] h-full w-0.5 bg-purple-400/90" />
          <span className="absolute top-0 left-[52%] h-full w-1 rounded-sm bg-amber-400" />
          <span className="absolute top-0 left-[57%] h-full w-0.5 bg-green-500/80" />
          <span className="absolute top-0 left-[81%] h-full w-1 rounded-sm bg-amber-400" />
          {/* Clip selection */}
          <div className="absolute inset-y-0 left-[50%] w-[10%] rounded-sm border-2 border-amber-400/90 bg-amber-400/15">
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
              New clip 0:42
            </span>
          </div>
          {/* Playhead */}
          <span className="absolute -top-1 left-[62%] h-12 w-0.5 bg-white/80" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-500/80" />
            Follow
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-purple-400/90" />
            Sub
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Clip
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm border border-white/30" />
            Muted audio
          </span>
        </div>
      </div>
    </div>
  );
}

export async function ClipsVods() {
  const clips = await getShowcaseClips();

  return (
    <section className="relative py-20">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      <div className="absolute inset-0 -z-10 bg-white/[0.02]" />

      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Every clip from your channel, organized.</h2>
          <p className="mt-4 text-muted-foreground">
            StreamWizard syncs every clip from your Twitch channel, including right when your stream
            ends. Search by title, filter by category or who clipped it, and file them into clip
            folders you create.
          </p>
        </div>
      </div>

      {/* Full-bleed marquee of real clips */}
      <Reveal>
        <ClipsMarquee clips={clips} />
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Real clips, synced by StreamWizard streamers
        </p>
      </Reveal>

      <div className="container mx-auto mt-14 px-4">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <VodTimelineStrip />
          </Reveal>
          <Reveal>
            <div className="grid gap-6 sm:grid-cols-2">
              {features.map(({ icon: Icon, title, body }) => (
                <div key={title}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-amber-400" aria-hidden="true" />
                    <h3 className="text-sm font-semibold">{title}</h3>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="mt-12 text-center">
          <Link
            href={docsClipsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-amber-300 transition-colors hover:text-amber-200"
          >
            How clip sync works
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
    </section>
  );
}
