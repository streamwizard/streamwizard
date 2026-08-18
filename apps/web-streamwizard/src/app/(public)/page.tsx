import { BarChart3, Clapperboard, CreditCard, Layers, Radio, Users } from "lucide-react";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { SignalClockProvider } from "@/components/public/signal/clock";
import { Spine, SpineSection } from "@/components/public/signal/spine";
import { HomeHero } from "@/components/public/home/hero";
import { IrlSection } from "@/components/public/home/irl-section";
import { OverlaysSection } from "@/components/public/home/overlays-section";
import { ClipsSection } from "@/components/public/home/clips-section";
import { AnalyticsSection } from "@/components/public/home/analytics-section";
import { CommunitySection } from "@/components/public/home/community-section";
import { PricingTeaser } from "@/components/public/home/pricing-teaser";
import { GoLiveClose } from "@/components/public/home/go-live-close";
import { absoluteUrl, softwareApplicationSchema } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: { canonical: absoluteUrl("/") },
};

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <JsonLd schema={softwareApplicationSchema()} />
      <SignalClockProvider>
        <HomeHero />
        <div className="container mx-auto px-4">
          <Spine>
            <SpineSection icon={Radio} tone="text-[#9e7aff]" title="IRL streaming" id="irl">
              <IrlSection />
            </SpineSection>
            <SpineSection icon={Layers} tone="text-[#3b82f6]" title="Overlays &amp; widgets" id="overlays">
              <OverlaysSection />
            </SpineSection>
            <SpineSection icon={Clapperboard} tone="text-[#4ade80]" title="Clips &amp; VODs" id="clips">
              <ClipsSection />
            </SpineSection>
            <SpineSection icon={BarChart3} tone="text-[#3b82f6]" title="Stream analytics" density="quiet">
              <AnalyticsSection />
            </SpineSection>
            <SpineSection icon={Users} tone="text-[#9e7aff]" title="Open source, on purpose" id="community">
              <CommunitySection />
            </SpineSection>
            <SpineSection icon={CreditCard} tone="text-[#4ade80]" title="Pricing" density="quiet">
              <PricingTeaser />
            </SpineSection>
          </Spine>
        </div>
        <GoLiveClose />
      </SignalClockProvider>
    </div>
  );
}
