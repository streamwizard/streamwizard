// Ensure this import path is correct for your project structure
import SectionWithMockup from "@/components/blocks/section-with-mockup";
// Data for the first section (default layout)
const exampleData1 = {
  title: <>Find the best moments from your streams,</>,
  description: (
    <>
      Never miss your best moments again. StreamWizard automatically records all stream events, including follows, subscriptions, raids, and Twitch markers, so you can quickly navigate through your
      stream and find the highlights. Twitch markers appear directly in StreamWizard, allowing you to instantly create clips and share your best moments with your community.
    </>
  ),
  primaryImageSrc: "/img/landing-page/video-player.png",
  secondaryImageSrc: "/img/landing-page/video-player-bg.png",
};

// Changed from 'export default function ...' to 'export function ...'
export default function VideoSection() {
  return <SectionWithMockup title={exampleData1.title} description={exampleData1.description} primaryImageSrc={exampleData1.primaryImageSrc} secondaryImageSrc={exampleData1.secondaryImageSrc} />;
}
