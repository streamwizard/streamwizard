import { TestimonialsSection } from "@/components/blocks/testimonials-with-marquee";
import TwitchLogin from "@/components/buttons/TwitchLogin";
import { BorderBeam } from "@/components/ui/border-beam";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Particles from "@/components/ui/particles";
import { discordInviteLink } from "@/lib/constant";
import { cn } from "@/lib/utils";
import { ArrowRight, BarChart3, Database, Filter, FolderKanban, Layers, Layout, MessageSquareCode, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FaDiscord } from "react-icons/fa";

export default function Home() {
  const features = [
    {
      icon: <Search className="w-6 h-6" />,
      title: "Advanced Search",
      description: "Find clips by title, creator, date, category, and more",
    },
    {
      icon: <FolderKanban className="w-6 h-6" />,
      title: "Clip Organization",
      description: "Create folders and organize clips your way",
    },
    {
      icon: <Database className="w-6 h-6" />,
      title: "Clip Sync",
      description: "Automatically sync your Twitch clips to our database",
    },
    {
      icon: <MessageSquareCode className="w-6 h-6" />,
      title: "Chat Commands",
      description: "Coming soon: Custom Twitch chat commands",
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Analytics",
      description: "Coming soon: Detailed stream performance analytics",
    },
    {
      icon: <Layout className="w-6 h-6" />,
      title: "Custom Overlays",
      description: "Coming soon: Create stunning stream overlays",
    },
  ];

  const steps = [
    {
      icon: <Database className="w-6 h-6" />,
      title: "Connect",
      description: "Link your Twitch account to StreamWizard",
    },
    {
      icon: <Filter className="w-6 h-6" />,
      title: "Sync",
      description: "Your clips are automatically imported and organized",
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

  const testimonials = [
    {
      author: {
        name: "Emma Thompson",
        handle: "@emmaai",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face",
      },
      text: "Using this AI platform has transformed how we handle data analysis. The speed and accuracy are unprecedented.",
      href: "https://twitter.com/emmaai",
    },
    {
      author: {
        name: "David Park",
        handle: "@davidtech",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
      },
      text: "The API integration is flawless. We've reduced our development time by 60% since implementing this solution.",
      href: "https://twitter.com/davidtech",
    },
    {
      author: {
        name: "Sofia Rodriguez",
        handle: "@sofiaml",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face",
      },
      text: "Finally, an AI tool that actually understands context! The accuracy in natural language processing is impressive.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative pt-20 ">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-blue-500 to-green-400 pb-6">
              StreamWizard: The Ultimate Clip Management Tool for Twitch Streamers
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Powerful clip search, folder organization, and upcoming Twitch tools to take your stream to the next level
            </p>
            <TwitchLogin redirect="/dashboard/clips" text="Login With Twitch" variant="default" size="lg" className="" />
            <Particles className="absolute inset-0 z-0" quantity={50} ease={80} color="#fffff" />
          </div>

          {/* Mock Interface */}
          <div className="hero-mock-interface animate-fade-up [--animation-delay:400ms]">
            <div className="rounded-xl border border-white/10 bg-white bg-opacity-[0.01]">
              <Image src="/hero-dark.png" alt="StreamWizard Interface" width={1440} height={900} className="rounded-xl " />
            </div>
            <BorderBeam size={250} duration={12} delay={9} />
          </div>

          {/* Logo Cloud */}
          <div className="hero-logo-cloud animate-fade-up [--animation-delay:600ms]">
            <p>Trusted by teams from around the world</p>
            <div className="logos">
              <span className="text-xl font-bold">Google</span>
              <span className="text-xl font-bold">Microsoft</span>
              <span className="text-xl font-bold">GitHub</span>
              <span className="text-xl font-bold">Uber</span>
              <span className="text-xl font-bold">Notion</span>
            </div>
          </div>
        </div>
        {/* Horizon / Stage Effect */}
        <div className="hero-horizon" />
      </section>

      {/* Testimonials */}
      <TestimonialsSection title="Stream. Search. Simplify." description="Where stream moments meet next-level simplicity" testimonials={testimonials} />
      {/* Future Roadmap */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-12">Coming Soon</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="p-6 bg-card border-purple-500/50">
              <BarChart3 className="w-8 h-8 text-purple-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Advanced Analytics</h3>
              <p className="text-muted-foreground">Track stream performance and viewer engagement</p>
            </Card>
            <Card className="p-6 bg-card border-blue-500/50">
              <MessageSquareCode className="w-8 h-8 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Chat Commands</h3>
              <p className="text-muted-foreground">Custom commands and automated responses</p>
            </Card>
            <Card className="p-6 bg-card border-green-500/50">
              <Layout className="w-8 h-8 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Stream Overlays</h3>
              <p className="text-muted-foreground">Create professional streaming overlays</p>
            </Card>
          </div>
          <Link href={discordInviteLink} target="_blank" className={cn(buttonVariants({ size: "lg" }), "mt-12 bg-slate-50 text-black")}>
            <FaDiscord className="w-6 h-6 fill-purple-600" />
            Join the Discord
            <ArrowRight className="ml-2" />
          </Link>
        </div>
      </section>
    </div>
  );
}
