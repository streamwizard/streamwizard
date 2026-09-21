import { History, RadioTower, RefreshCw } from "lucide-react";
import { SectionView } from "../analytics/section-view";
import { Reveal } from "../home/reveal";
import { SyncTimeline } from "./sync-timeline";

/*
 * The sync story is the one thing the folders mock above cannot show: clips
 * arrive on their own, while the stream is still going. The vignette plays
 * the five-minute check on loop and the last pass at the end; the bullets
 * carry the mechanics, including the once-an-hour honesty on the button.
 */

const SYNC_FEATURES = [
  {
    icon: RadioTower,
    title: "Every five minutes, while live",
    body: "Chat clips it, and within five minutes it's in your library. Rotate it on an overlay before the stream is over.",
  },
  {
    icon: History,
    title: "One last pass at the end",
    body: "View counts and VOD timestamps settle late on Twitch. The end-of-stream sync catches those and any clip from the final minutes. Your first sync also walks the whole backlog, a hundred at a time.",
  },
  {
    icon: RefreshCw,
    title: "A Sync button, still there",
    body: "Turned auto sync off? Hit Sync in the filter bar. Once an hour, because Twitch has rate limits and so do we.",
  },
];

export function ClipsSyncSection() {
  return (
    <section className="py-20">
      <SectionView section="clips_sync" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs tracking-widest text-purple-300 uppercase">Auto sync</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Clips land while you&apos;re still live.</h2>
          <p className="mt-4 text-muted-foreground">
            Every five minutes on stream, StreamWizard checks Twitch for new clips and files them. When
            you go offline it does one last pass. Nothing to export, nothing to remember.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
          <Reveal direction="left">
            <SyncTimeline />
          </Reveal>
          <Reveal direction="right">
            <div className="space-y-6">
              {SYNC_FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-purple-400" aria-hidden="true" />
                    <h3 className="text-sm font-semibold">{title}</h3>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </SectionView>
    </section>
  );
}
