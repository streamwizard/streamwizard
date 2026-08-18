import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { docsClipsLink } from "@/lib/constant";

/*
 * The original product, proved with the real dashboard screenshot rather than
 * an abstraction.
 */
export function ClipsSection() {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
      <div>
        <p className="max-w-xl text-base text-muted-foreground md:text-lg">
          Every clip you have ever made, synced and searchable. Folders, filters by game, date and title, and a VOD
          player for the moments nobody clipped.
        </p>
        <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
          <li>Folders you control. Drag clips in, sort by game, date, or vibe.</li>
          <li>Search by game, title or date range. Seconds, not an evening of scrolling.</li>
          <li>A VOD player for the moments Twitch never cut for you.</li>
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-5">
          <Link
            href="/clips"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Explore clips
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={docsClipsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Clips docs
          </Link>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg shadow-black/40">
        <Image
          src="/img/landing-page/hero-dark.webp"
          alt="The StreamWizard dashboard showing a Twitch clip library sorted into folders"
          width={2539}
          height={1271}
          sizes="(min-width: 1024px) 40vw, 90vw"
          className="h-auto w-full"
        />
      </div>
    </div>
  );
}
