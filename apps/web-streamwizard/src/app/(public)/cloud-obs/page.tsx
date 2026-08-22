import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";
import { CloudObsShowcase } from "@/components/public/home/cloud-obs-showcase";
import { IrlOverlaysSection } from "@/components/public/cloud-obs/irl-overlays-section";
import { FinalCta } from "@/components/public/home/final-cta";

/*
 * Cloud OBS for IRL streamers: the showcase from the landing page, then the
 * overlays section in its IRL reading (GPS stats on stream). First pass: the
 * sections are the landing page's, the page just gives them a home of their
 * own. A proper hero and the pricing story come later.
 */
export const metadata: Metadata = {
  title: "Cloud OBS for IRL streaming",
  description:
    "A dedicated OBS for your channel in the cloud, run from the deck on your phone. Auto switcher, SRT and SRTLA ingest, and overlays with live GPS stats. Stream IRL without a PC.",
  alternates: { canonical: absoluteUrl("/cloud-obs") },
};

export default function CloudObsPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <section className="pt-16 md:pt-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-purple-300">Cloud OBS</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Your OBS, in the cloud. <br /> Your phone runs it.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Built for IRL streamers. A dedicated OBS for your channel, the deck on your phone to control it, and
              overlays that show where you are.
            </p>
          </div>
        </div>
      </section>
      <CloudObsShowcase showProductLink={false} />
      <IrlOverlaysSection />
      <FinalCta />
    </div>
  );
}
