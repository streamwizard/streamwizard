import { CalendarIcon, FileTextIcon } from "@radix-ui/react-icons";
import { BellIcon, DownloadIcon, SearchIcon, Share2Icon, VideoIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Calendar } from "@repo/ui";
import { BentoCard, BentoGrid } from "@repo/ui";
import { Marquee } from "@repo/ui";

const files = [
  {
    name: "bitcoin.pdf",
    body: "Bitcoin is a cryptocurrency invented in 2008 by an unknown person or group of people using the name Satoshi Nakamoto.",
  },
  {
    name: "finances.xlsx",
    body: "A spreadsheet or worksheet is a file made of rows and columns that help sort data, arrange data easily, and calculate numerical data.",
  },
  {
    name: "logo.svg",
    body: "Scalable Vector Graphics is an Extensible Markup Language-based vector image format for two-dimensional graphics with support for interactivity and animation.",
  },
  {
    name: "keys.gpg",
    body: "GPG keys are used to encrypt and decrypt email, files, directories, and whole disk partitions and to authenticate messages.",
  },
  {
    name: "seed.txt",
    body: "A seed phrase, seed recovery phrase or backup seed phrase is a list of words which store all the information needed to recover Bitcoin funds on-chain.",
  },
];

const features = [
  {
    Icon: DownloadIcon,
    name: "Download your clips",
    description: "Download your clips directly from the dashboard",
    href: "#",
    cta: "Learn more",
    className: "col-span-3 lg:col-span-1",
    background: (
      <Marquee pauseOnHover className="absolute top-10 mask-[linear-gradient(to_top,transparent_40%,#000_100%)] [--duration:20s]">
        {files.map((f, idx) => (
          <figure
            key={idx}
            className={cn(
              "relative w-32 cursor-pointer overflow-hidden rounded-xl border p-4",
              "border-gray-950/10 bg-gray-950/1 hover:bg-gray-950/5",
              "dark:border-gray-50/10 dark:bg-gray-50/10 dark:hover:bg-gray-50/15",
              "transform-gpu blur-[1px] transition-all duration-300 ease-out hover:blur-none",
            )}
          >
            <div className="flex flex-row items-center gap-2">
              <div className="flex flex-col">
                <figcaption className="text-sm font-medium dark:text-white">{f.name}</figcaption>
              </div>
            </div>
            <blockquote className="mt-2 text-xs">{f.body}</blockquote>
          </figure>
        ))}
      </Marquee>
    ),
  },
  {
    Icon: SearchIcon,
    name: "Search with ease",
    description: "Search your clips with ease",
    href: "#",
    cta: "Learn more",
    className: "col-span-3 lg:col-span-2",
    background: <></>,
  },
  {
    Icon: VideoIcon,
    name: "VOD player",
    description: "Find your most epic moments in your VODs",
    href: "#",
    cta: "Learn more",
    className: "col-span-3 lg:col-span-2",
    background: <></>,
  },
  {
    Icon: CalendarIcon,
    name: "Calendar",
    description: "Use the calendar to filter your files by date.",
    className: "col-span-3 lg:col-span-1",
    href: "#",
    cta: "Learn more",
    background: (
      <Calendar
        mode="single"
        selected={new Date(2022, 4, 11, 0, 0, 0)}
        className="absolute top-10 right-0 origin-top scale-75 rounded-md border mask-[linear-gradient(to_top,transparent_40%,#000_100%)] transition-all duration-300 ease-out group-hover:scale-90"
      />
    ),
  },
];

export function BentoDemo() {
  return (
    <BentoGrid className="container mx-auto">
      {features.map((feature, idx) => (
        <BentoCard key={idx} {...feature} />
      ))}
    </BentoGrid>
  );
}
