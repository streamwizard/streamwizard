import Image from "next/image";
import Link from "next/link";
import TwitchLogin from "../buttons/twitch-login";
import { Particles, BorderBeam, CurvedSection as HorizonStage } from "@repo/ui";
import { Database, Filter, Layers, Search } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { githubLink } from "@/lib/constant";

const steps = [
  {
    icon: <Database className="w-6 h-6" />,
    title: "Connect",
    description: "Login with your Twitch account",
  },
  {
    icon: <Filter className="w-6 h-6" />,
    title: "Sync",
    description: "Your clips are automatically imported",
  },
  {
    icon: <Layers className="w-6 h-6" />,
    title: "Organize",
    description: "Create folders and categorize your clips",
  },
  {
    icon: <Search className="w-6 h-6" />,
    title: "Search",
    description: "Find any clip instantly",
  },
];

export default function Hero() {
  return (
    <section className="relative pt-20">
      <div className="container px-4 mx-auto relative z-10">
        <div className="text-center">
          {/* Open source badge */}
          <Link
            href={githubLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/40 bg-purple-500/10 text-purple-300 text-sm hover:bg-purple-500/20 transition-colors mb-6"
          >
            <FaGithub className="h-4 w-4" />
            Open Source
          </Link>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold bg-clip-text text-transparent bg-linear-to-r from-purple-400 via-blue-500 to-green-400 pb-6">
            No more searching hours for that one clip.
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Organize your Twitch clips. Search by game, date, or title. Actually find the moment you&apos;re looking for.
          </p>
          <TwitchLogin redirect="/dashboard/clips" text="Login With Twitch" variant="default" size="lg" className="" />
          <Particles className="absolute inset-0 z-0" quantity={50} ease={80} color="#fffff" />
        </div>

        <div className="relative rounded-xl mt-16 z-10 after:content-[''] after:absolute after:inset-0 after:z-50 after:rounded-[inherit] after:bg-[linear-gradient(to_top,var(--background)_10%,transparent_60%)] after:pointer-events-none before:content-[''] before:absolute before:[-inset:5rem] before:-z-10 before:filter-[blur(120px)] before:bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--color-three),transparent_70%),transparent_70%)] before:opacity-50 animate-fade-up [--animation-delay:400ms]">
          <div className="rounded-xl aspect-video relative">
            <Image src="/img/landing-page/hero-dark.png" alt="StreamWizard Interface" fill sizes="(max-width: 768px) 100vw, 90vw" className="rounded-xl object-cover" priority />
          </div>
          <BorderBeam size={250} duration={12} delay={9} />
        </div>
      </div>

      <HorizonStage className="mt-16 min-h-[1000px] lg:min-h-0">
        <div className="container px-4 mx-auto lg:mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {steps.map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-purple-600 flex items-center justify-center mx-auto mb-3">{step.icon}</div>
                <h3 className="text-base lg:text-xl font-semibold mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </HorizonStage>
    </section>
  );
}
