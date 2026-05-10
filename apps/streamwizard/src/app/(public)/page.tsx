import { TestimonialsSection } from "@/components/blocks/testimonials-with-marquee";
import Hero from "@/components/public/hero";
import VideoSection from "@/components/public/video-section";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <Hero />

      {/* Testimonials */}
      <TestimonialsSection />

      <VideoSection />
    </div>
  );
}
