import { CalendarIcon } from "@radix-ui/react-icons";
import { SearchIcon, VideoIcon, FolderIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { BentoCard, BentoGrid } from "@repo/ui";
import { Marquee } from "@repo/ui";
import { CalendarBackground } from "./calendar-background";

const clips = [
  { name: "clutch_1v5_valorant.mp4", body: "That 1v5 clutch on Bind — 847 people clipped it." },
  { name: "epic_raid_moment.mp4", body: "The raid that broke your viewer count record." },
  { name: "funniest_chat_reaction.mp4", body: "Chat completely lost it. Worth saving." },
  { name: "speedrun_pb.mp4", body: "New personal best. 4:23.1." },
  { name: "first_champion_kill.mp4", body: "Three weeks of grinding. Worth it." },
];

const features = [
  {
    Icon: FolderIcon,
    name: "Clip folders",
    description: "Create folders and sort your highlights by game, date, or vibe — not by whatever random order Twitch dumped them in.",
    href: "/dashboard/clips",
    cta: "Try it",
    className: "col-span-1 md:col-span-1",
    background: (
      <Marquee pauseOnHover className="absolute top-10 mask-[linear-gradient(to_top,transparent_40%,#000_100%)] [--duration:20s]">
        {clips.map((clip, idx) => (
          <figure
            key={idx}
            className={cn(
              "relative w-40 cursor-pointer overflow-hidden rounded-xl border p-4",
              "border-gray-950/10 bg-gray-950/1 hover:bg-gray-950/5",
              "dark:border-gray-50/10 dark:bg-gray-50/10 dark:hover:bg-gray-50/15",
              "transform-gpu blur-[1px] transition-all duration-300 ease-out hover:blur-none",
            )}
          >
            <div className="flex flex-col gap-1">
              <figcaption className="text-xs font-medium dark:text-white truncate">{clip.name}</figcaption>
              <blockquote className="mt-1 text-xs text-muted-foreground">{clip.body}</blockquote>
            </div>
          </figure>
        ))}
      </Marquee>
    ),
  },
  {
    Icon: SearchIcon,
    name: "Search any clip",
    description: "Search by game, streamer, title, or date range. Find the moment in seconds, not hours.",
    href: "/dashboard/clips",
    cta: "Try it",
    className: "col-span-1 md:col-span-2",
    background: <></>,
  },
  {
    Icon: VideoIcon,
    name: "VOD player",
    description: "Find your most epic moments inside your full VODs — not just the clips Twitch already cut.",
    href: "/dashboard/clips",
    cta: "Try it",
    className: "col-span-1 md:col-span-2",
    background: <></>,
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
