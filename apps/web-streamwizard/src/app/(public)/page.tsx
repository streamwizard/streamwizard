import Hero from "@/components/public/hero";
import VideoSection from "@/components/public/video-section";
import { FeaturesSection } from "@/components/public/features";
import { OpenSourceSection } from "@/components/public/open-source-section";
import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl, softwareApplicationSchema } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: absoluteUrl("/") },
};

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <JsonLd schema={softwareApplicationSchema()} />
      <Hero />
      <FeaturesSection />
      <OpenSourceSection />
      <VideoSection />
    </div>
  );
}
