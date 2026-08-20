import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl, softwareApplicationSchema } from "@/lib/seo";
import { Hero } from "@/components/public/home/hero";
import { TrustBand } from "@/components/public/home/trust-band";
import { Pillars } from "@/components/public/home/pillars";
import { CloudObsShowcase } from "@/components/public/home/cloud-obs-showcase";
import { OverlaysSection } from "@/components/public/home/overlays-section";
import { ClipsVods } from "@/components/public/home/clips-vods";
import { AnalyticsDemo } from "@/components/public/home/analytics-demo";
import { WhyStreamwizard } from "@/components/public/home/why-streamwizard";
import { FinalCta } from "@/components/public/home/final-cta";

// The clips marquee reads from the database; the hourly refresh lives on the
// cached data call in src/lib/showcase-clips.ts (this route renders
// dynamically because JsonLd carries the per-request CSP nonce).
export const metadata: Metadata = {
  description:
    "Cloud OBS for IRL streaming, overlays, clip management, and stream analytics for Twitch. Open source and built in public.",
  alternates: { canonical: absoluteUrl("/") },
};

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <JsonLd schema={softwareApplicationSchema()} />
      <Hero />
      <TrustBand />
      {/*<Pillars />*/}
      <CloudObsShowcase />
      <OverlaysSection />
      <ClipsVods />
      <AnalyticsDemo />
      <WhyStreamwizard />
      <FinalCta />
    </div>
  );
}
