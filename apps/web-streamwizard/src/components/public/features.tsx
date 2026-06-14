import { CalendarIcon } from "@radix-ui/react-icons";
import { SearchIcon, VideoIcon, FolderIcon } from "lucide-react";

import { BentoCard, BentoGrid } from "@repo/ui";
import { CalendarBackground } from "./calendar-background";
import { ClipFoldersBackground } from "./clip-folders-background";
import { SearchFilterBackground } from "./search-filter-background";
import { VodPlayerBackground } from "./vod-player-background";

const features = [
  {
    Icon: FolderIcon,
    name: "Clip folders",
    description: "Create folders and sort your highlights by game, date, or vibe — not by whatever random order Twitch dumped them in.",
    href: "/dashboard/clips",
    cta: "Try it",
    className: "col-span-1 md:col-span-1",
    background: <ClipFoldersBackground />,
  },
  {
    Icon: SearchIcon,
    name: "Search any clip",
    description: "Search by game, streamer, title, or date range. Find the moment in seconds, not hours.",
    href: "/dashboard/clips",
    cta: "Try it",
    className: "col-span-1 md:col-span-2",
    background: <SearchFilterBackground />,
  },
  {
    Icon: VideoIcon,
    name: "VOD player",
    description: "Find your most epic moments inside your full VODs — not just the clips Twitch already cut.",
    href: "/dashboard/clips",
    cta: "Try it",
    className: "col-span-1 md:col-span-2",
    background: <VodPlayerBackground />,
  },
  {
    Icon: CalendarIcon,
    name: "Filter by date",
    description: "Pick any date range and see exactly what you clipped. No guessing.",
    className: "col-span-1 md:col-span-1",
    href: "/dashboard/clips",
    cta: "Try it",
    background: <CalendarBackground />,
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20">
      <div className="container px-4 mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">What StreamWizard does</h2>
        <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
          Clip management that doesn&apos;t treat you like an enterprise customer.
        </p>
        <BentoGrid className="mx-auto grid-cols-1 md:grid-cols-3">
          {features.map((feature, idx) => (
            <BentoCard key={idx} {...feature} />
          ))}
        </BentoGrid>
      </div>
    </section>
  );
}
