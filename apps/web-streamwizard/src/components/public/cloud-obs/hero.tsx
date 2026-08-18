import Link from "next/link";
import { FaDiscord } from "react-icons/fa";
import { PipelineBand } from "@/components/public/signal/pipeline";
import { discordInviteLink } from "@/lib/constant";

/*
 * Same first viewport as the homepage: claim, lede, CTAs, then the signal path
 * drawn live underneath. Here the claim is the product's, not the toolkit's,
 * and the CTA is request-access because Cloud OBS is switched on by hand.
 */
export function CloudObsHero() {
  return (
    <section className="relative flex min-h-[calc(100svh-6rem)] flex-col justify-center pt-16 pb-12">
      <div className="container mx-auto px-4">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
          Your OBS runs in the cloud. You just walk.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground md:text-xl">
          Stream IRL without a PC on your back. Your phone sends one feed, StreamWizard runs the OBS, watches the
          connection every second, and switches scenes before chat notices.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href={discordInviteLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <FaDiscord className="h-4 w-4" aria-hidden="true" />
            Request access
          </Link>
          {/* Plain anchor on purpose: next/link swallows same-page hash jumps
              in the app router, so the native one does the scrolling. */}
          <a
            href="#pricing"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-transparent px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            See what it costs
          </a>
        </div>

        <div className="mt-20 md:mt-24">
          <PipelineBand />
        </div>
      </div>
    </section>
  );
}
