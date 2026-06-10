import { TestimonialsSection } from "@/components/blocks/testimonials-with-marquee";
import Hero from "@/components/public/hero";
import VideoSection from "@/components/public/video-section";
import { FeaturesSection } from "@/components/public/features";
import { OpenSourceSection } from "@/components/public/open-source-section";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Hero />
      <FeaturesSection />
      <OpenSourceSection />
      <TestimonialsSection />
      <VideoSection />
    </div>
  );
}
