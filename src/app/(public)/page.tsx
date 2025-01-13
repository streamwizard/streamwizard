import TwitchLogin from "@/components/buttons/TwitchLogin";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
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

  const testimonials = [
    {
      quote: "StreamWizard revolutionized how I manage my clips. It's a game-changer!",
      author: "TwitchPro99",
      role: "Variety Streamer",
    },
    {
      quote: "The search functionality alone saved me hours of work. Absolutely worth it!",
      author: "GameMaster42",
      role: "Esports Streamer",
    },
    {
      quote: "Finally, a tool that understands what streamers actually need.",
      author: "StreamQueen",
      role: "IRL Streamer",
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
          <div className="relative rounded-xl mt-[8rem] animate-fade-up  [--animation-delay:400ms] [perspective:2000px] after:absolute after:inset-0 after:z-50 after:[background:linear-gradient(to_top,hsl(var(--background))_30%,transparent)] before:absolute before:bottom-1/2 before:left-0 before:top-0 before:h-full before:w-full before:-z-10  before:[filter:blur(180px)] before:content-[''] e before:inset-0 before:bg-gradient-to-b before:from-purple-600 before:via-purple-600 before:to-transparent before:opacity-40">
            <div className="rounded-xl border border-white/10 bg-white bg-opacity-[0.01]">
              <Image src="/hero-dark.png" alt="StreamWizard Interface" width={1440} height={900} className="rounded-xl " />
            </div>
            <BorderBeam size={250} duration={12} delay={9} />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">Powerful Features for Streamers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <Card key={i} className="p-6 bg-card hover:bg-accent/50 transition-colors">
                <div className="mb-4 text-purple-500">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
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
      </section>

      <div className="[--color:theme(colors.purple.600)] pointer-events-none relative z-0 mx-auto h-[50rem] overflow-hidden [mask-image:radial-gradient(ellipse_at_center_center,#000,transparent_50%)] -my-80 md:-my-72 before:absolute before:inset-0 before:h-full before:w-full before:opacity-40 before:[background-image:radial-gradient(circle_at_bottom_center,var(--color),transparent_70%)] after:absolute after:-left-1/2 after:top-1/2 after:aspect-[1/0.7] after:w-[200%] after:rounded-[50%] after:border-t after:border-[hsl(var(--border))] after:bg-background hidden md:block" />
      {/* Testimonials */}
      <section className="py-20 bg-card z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">What Streamers Say</h2>
          <Carousel className="max-w-xl mx-auto">
            <CarouselContent>
              {testimonials.map((testimonial, i) => (
                <CarouselItem key={i}>
                  <Card className="p-6 bg-card">
                    <p className="text-lg mb-4">{testimonial.quote}</p>
                    <p className="font-semibold">{testimonial.author}</p>
                    <p className="text-muted-foreground">{testimonial.role}</p>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden" />
            <CarouselNext className="hidden" />
          </Carousel>
        </div>
      </section>

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
