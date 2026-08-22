import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";
import { VodClipping } from "@/components/public/home/vod-clipping-section";
import { FinalCta } from "@/components/public/home/final-cta";

/*
 * First pass, same shape as /cloud-obs: a hero of its own, then the landing
 * page's section. The timeline in detail, the event markers and the download
 * formats get their own copy later.
 */
export const metadata: Metadata = {
  title: "Clip from your Twitch VODs",
  description:
    "Find the moment nobody clipped. Follows, subs, raids and ad breaks sit on the VOD timeline, so you can drag a 5 to 60 second selection out of it and save it as a clip.",
  alternates: { canonical: absoluteUrl("/vods") },
};

export default function VodsPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <section className="pt-16 md:pt-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-amber-300">VODs</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              The clip button <br /> nobody pressed.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Open the VOD, find the moment on a timeline that marks every follow, sub and raid, and
              cut it yourself.
            </p>
          </div>
        </div>
      </section>
      <VodClipping showProductLink={false} />
      <FinalCta />
    </div>
  );
}
