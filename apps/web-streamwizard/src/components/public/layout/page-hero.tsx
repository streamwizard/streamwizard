import type { ReactNode } from "react";
import { cn } from "@repo/ui";

/*
 * The standard top of a public page: eyebrow, headline, one line of lede.
 *
 * The product pages each inline this same block. It lives here so the company
 * pages (/about, /contact, /roadmap) stay identical to each other
 * without a fifth copy of the markup.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  eyebrowClassName,
}: {
  eyebrow: string;
  title: ReactNode;
  lede: ReactNode;
  /** Product pages tint this per pillar; company pages leave it muted. */
  eyebrowClassName?: string;
}) {
  return (
    <section className="pt-16 md:pt-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <p
            className={cn(
              "font-mono text-xs uppercase tracking-widest text-muted-foreground",
              eyebrowClassName
            )}
          >
            {eyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">{title}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">{lede}</p>
        </div>
      </div>
    </section>
  );
}
