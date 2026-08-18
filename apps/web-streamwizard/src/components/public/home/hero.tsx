import Link from "next/link";
import { FaGithub } from "react-icons/fa";
import TwitchLogin from "@/components/buttons/twitch-login";
import { githubLink } from "@/lib/constant";
import { PipelineBand } from "@/components/public/signal/pipeline";

/*
 * First viewport: the open-source manifesto beside the live signal path. The
 * pipeline is the thesis, the manifesto keeps the umbrella claim (free, MIT,
 * built in public) from being eclipsed by the IRL story.
 */
export function HomeHero() {
  return (
    <section className="relative flex min-h-[calc(100svh-6rem)] flex-col justify-center pt-16 pb-12">
      <div className="container mx-auto px-4">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
          Your whole stream setup, in one open-source toolkit.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground md:text-xl">
          Clips, overlays and analytics. Free forever, MIT-licensed, built in public. Add Cloud OBS and your IRL
          stream stays up even when your phone&apos;s signal doesn&apos;t.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <TwitchLogin redirect="/dashboard" text="Connect Twitch" variant="default" size="lg" source="hero" />
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

        <div className="mt-20 md:mt-24">
          <PipelineBand />
        </div>
      </div>
    </section>
  );
}
