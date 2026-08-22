import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";
import { OverlaysSection } from "@/components/public/home/overlays-section";
import { FinalCta } from "@/components/public/home/final-cta";

/*
 * First pass, same shape as /cloud-obs: a hero of its own, then the landing
 * page's section. The widget-by-widget breakdown, the editor tour and the
 * setup walkthrough come later.
 */
export const metadata: Metadata = {
  title: "Stream overlays and alerts",
  description:
    "Alerts, chat, labels and IRL widgets in one browser source. Build the scene in the editor, paste one URL into OBS, and change it without touching OBS again.",
  alternates: { canonical: absoluteUrl("/overlays") },
};

export default function OverlaysPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <section className="pt-16 md:pt-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-purple-300">Overlays</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              One browser source. <br /> Every alert you need.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Build the scene here, paste one URL into OBS, and never go back into OBS to change it.
            </p>
          </div>
        </div>
      </section>
      <OverlaysSection showProductLink={false} />
      <FinalCta />
    </div>
  );
}
