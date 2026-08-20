"use client";

import Image from "next/image";
import Link from "next/link";
import { FaGithub } from "react-icons/fa";
import TwitchLogin from "@/components/buttons/twitch-login";
import { githubLink } from "@/lib/constant";

/*
 * Prototype variant: the category standard, played straight and at full craft.
 * Centered claim, purple wash, the real dashboard screenshot in a framed card.
 * Deliberately indistinguishable from the category; that is its honest cost.
 */
export function CanonHero() {
  return (
    <section className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[60svh] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(158,122,255,0.18)_0%,transparent_100%)]"
      />

      <div className="container relative mx-auto px-4 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
          Your whole stream setup, in one open-source toolkit.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground md:text-xl">
          Clips, overlays and analytics. Free forever, MIT-licensed, built in public. Add Cloud OBS and your IRL
          stream stays up even when your phone&apos;s signal doesn&apos;t.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <TwitchLogin redirect="/dashboard" text="Connect Twitch" variant="default" size="lg" source="hero-proto-canon" />
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

        <div className="relative mx-auto mt-14 max-w-4xl overflow-hidden rounded-xl border border-border shadow-[0_24px_80px_-24px_rgba(158,122,255,0.35)]">
          <Image
            src="/img/landing-page/hero-dark.webp"
            alt="The StreamWizard dashboard"
            width={2539}
            height={1271}
            priority
            sizes="(min-width: 1024px) 896px, 100vw"
            className="h-auto w-full"
          />
        </div>
      </div>
    </section>
  );
}
