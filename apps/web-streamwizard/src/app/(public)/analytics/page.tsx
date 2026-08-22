import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";
import { AnalyticsDemo } from "@/components/public/home/analytics-demo";
import { FinalCta } from "@/components/public/home/final-cta";

/*
 * First pass, same shape as /cloud-obs: a hero of its own, then the landing
 * page's section. The chart-by-chart breakdown and the hourly/category story
 * get their own copy later.
 */
export const metadata: Metadata = {
  title: "Twitch stream analytics",
  description:
    "Your last broadcast, minute by minute. Follows, subs, raids and clips land on the viewer graph, the best hour gets called out, and the whole page is optional.",
  alternates: { canonical: absoluteUrl("/analytics") },
};

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <section className="pt-16 md:pt-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-purple-300">Analytics</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Last stream, <br /> explained.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Viewers minute by minute, every follow and sub in place, and the best hour named. On
              the days you would rather not know, one switch puts it away.
            </p>
          </div>
        </div>
      </section>
      <AnalyticsDemo showProductLink={false} />
      <FinalCta />
    </div>
  );
}
