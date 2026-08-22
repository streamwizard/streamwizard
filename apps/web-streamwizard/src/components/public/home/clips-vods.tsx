import { TrackedLink } from "../analytics/tracked-link";
import { SectionView } from "../analytics/section-view";
import { ArrowRight, Download, FolderInput, FolderTree, Search } from "lucide-react";
import { Button, cn } from "@repo/ui";
import { productLinks } from "@/lib/constant";
import { getShowcaseClips } from "@/lib/showcase-clips";
import { Reveal } from "./reveal";
import { ClipsMarquee } from "./clips-marquee";
import { ClipFoldersMock } from "./clip-folders-mock";

/*
 * Full-bleed band: the marquee escapes the container while the copy stays in
 * it. Amber is the product's clip color, reused here as the section accent.
 */

const folderFeatures = [
  {
    icon: FolderTree,
    title: "Folders you create",
    body: "Name them by game, meme format, or vibe, and nest them as deep as you want. Twitch dumps every clip in one pile; you do not have to keep it that way.",
  },
  {
    icon: FolderInput,
    title: "File a clip in two clicks",
    body: "Open a clip's menu, pick a folder, done. One clip can live in several folders, and Remove from folder takes it back out.",
  },
  {
    icon: Search,
    title: "Filters that stack",
    body: "Free text, category, who clipped it, date range, featured only. Sort by views or date, and every active filter shows as a chip you can drop.",
  },
  {
    icon: Download,
    title: "Landscape and portrait",
    body: "Download the portrait cut for Shorts and TikTok without opening an editor.",
  },
];

function FeatureList({ items, className }: { items: typeof folderFeatures; className?: string }) {
  return (
    <div className={cn("grid gap-6 sm:grid-cols-2", className)}>
      {items.map(({ icon: Icon, title, body }) => (
        <div key={title}>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <h3 className="text-sm font-semibold">{title}</h3>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
      ))}
    </div>
  );
}

export async function ClipsVods({ showProductLink = true }: { showProductLink?: boolean } = {}) {
  const clips = await getShowcaseClips();

  return (
    <section className="relative py-20">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      <div className="absolute inset-0 -z-10 bg-white/[0.02]" />
      <SectionView section="clips">

      <div className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Every clip from your channel, organized.</h2>
          <p className="mt-4 text-muted-foreground">
            StreamWizard syncs every clip from your Twitch channel, including right when your stream
            ends. Search by title, filter by category or who clipped it, and file them into clip
            folders you create.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-12">
          <Reveal>
            <ClipFoldersMock clips={clips} />
          </Reveal>
          <Reveal>
            <div>
              <h3 className="text-xl font-semibold">Find it, then file it.</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                That is the clips page beside you, running on real clips. Filter down to the one you
                meant, then drop it in a folder from the clip&apos;s own menu. Go on, move one.
              </p>
              <div className="mt-6">
                <FeatureList items={folderFeatures} className="sm:grid-cols-1" />
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* Full-bleed marquee of real clips */}
      <Reveal className="mt-16">
        <ClipsMarquee clips={clips} />
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Real clips, synced by StreamWizard streamers
        </p>
      </Reveal>

      <div className="container mx-auto px-4">
        {showProductLink ? (
          <div className="mt-12 text-center">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="gap-2 border-amber-400/30 bg-amber-400/[0.06] px-7 text-amber-200 shadow-md transition-transform duration-200 hover:-translate-y-0.5 hover:bg-amber-400/[0.12] hover:text-amber-100"
            >
              <TrackedLink href={productLinks.clips} cta="more_about_clips" section="clips">
                More about clips
                <ArrowRight className="size-4" aria-hidden="true" />
              </TrackedLink>
            </Button>
          </div>
        ) : null}
      </div>

      </SectionView>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
    </section>
  );
}
