import SectionWithMockup from "@/components/blocks/section-with-mockup";

const data = {
  title: "Find your best moments.",
  description: "Every follow, sub, raid, and Twitch marker is logged automatically. Jump straight to the highlight — no scrubbing required.",
  features: [
    "Twitch markers sync directly to your timeline",
    "Create and share clips with one click",
    "All stream events logged automatically",
  ],
  primaryImageSrc: "/img/landing-page/video-player.png",
  secondaryImageSrc: "/img/landing-page/video-player-bg.png",
};

export default function VideoSection() {
  return (
    <SectionWithMockup
      title={data.title}
      description={data.description}
      features={data.features}
      primaryImageSrc={data.primaryImageSrc}
      secondaryImageSrc={data.secondaryImageSrc}
      priority
    />
  );
}
