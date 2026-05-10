import Image from "next/image";
import TwitchLogin from "../buttons/TwitchLogin";
import Particles from "../ui/particles";
import { BorderBeam } from "../ui/border-beam";
import HorizonStage from "../ui/CurvedSection";
import { Database, Filter, Layers, Search } from "lucide-react";

const steps = [
  {
    icon: <Database className="w-6 h-6" />,
    title: "Connect",
    description: "Login with your twitch account",
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
    description: "Find any clip instantly with powerful search",
  },
];

export default function Hero() {
  return (
    <section className="relative pt-20 ">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-linear-to-r from-purple-400 via-blue-500 to-green-400 pb-6">
            StreamWizard: The Ultimate Clip Management Tool for Twitch Streamers
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8">Powerful clip search, folder organization, and upcoming Twitch tools to take your stream to the next level</p>
          <TwitchLogin redirect="/dashboard/clips" text="Login With Twitch" variant="default" size="lg" className="" />
          <Particles className="absolute inset-0 z-0" quantity={50} ease={80} color="#fffff" />
        </div>

        <div className="relative rounded-xl mt-16 z-10 after:content-[''] after:absolute after:inset-0 after:z-50 after:rounded-[inherit] after:bg-[linear-gradient(to_top,var(--background)_10%,transparent_60%)] after:pointer-events-none before:content-[''] before:absolute before:[-inset:5rem] before:-z-10 before:filter-[blur(120px)] before:bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--color-three),transparent_70%),transparent_70%)] before:opacity-50 animate-fade-up [--animation-delay:400ms]">
          <div className="rounded-xl">
            <Image src="/img/landing-page/hero-dark.png" alt="StreamWizard Interface" width={1440} height={900} className="rounded-xl " priority />
          </div>
          <BorderBeam size={250} duration={12} delay={9} />
        </div>
      </div>

      <HorizonStage className="mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center mx-auto mb-4">{step.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </HorizonStage>
    </section>
  );
}
