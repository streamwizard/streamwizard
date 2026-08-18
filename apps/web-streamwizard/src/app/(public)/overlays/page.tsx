import { Bell, Clapperboard, Code2, KeyRound, Layers, LibraryBig, MousePointerClick } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import TwitchLogin from "@/components/buttons/twitch-login";
import { DocsBand } from "@/components/public/signal/docs-band";
import { HeroEdgeStat } from "@/components/public/signal/stats";
import { ImageSlot } from "@/components/public/signal/image-slot";
import { SegmentHero } from "@/components/public/signal/segment-hero";
import { SignalClockProvider } from "@/components/public/signal/clock";
import { Spine, SpineSection } from "@/components/public/signal/spine";
import { docsLink } from "@/lib/constant";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Overlays & Widgets",
  description:
    "Build Twitch overlays in the browser. A drag-and-drop editor, a widget library, and a code editor for writing your own. OBS gets one browser source.",
  alternates: { canonical: absoluteUrl("/overlays") },
};

/* Real seeded template catalog — DB truth, not copy. */
const OVERLAY_TEMPLATES = ["blank", "starting-soon", "just-chatting", "clips-showcase", "alert-box", "auto-switcher-monitor", "walking-stats"];

export default function OverlaysPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <SignalClockProvider>
        <SegmentHero
          icon={Layers}
          tone="text-[#3b82f6]"
          station="overlay renderer · widget runtime"
          stat={<HeroEdgeStat label="events" base={24} spread={9} unit="/min" />}
          title="Overlays built in the browser, not in a zip file."
          lede="Design overlays on a canvas, drop in widgets from the library, write your own with the widget API. OBS gets one browser source."
        >
          <TwitchLogin redirect="/dashboard/overlays" text="Open the editor" variant="default" size="lg" source="overlays-page" />
          <Link
            href={`${docsLink}/overlays/quickstart`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Quickstart
          </Link>
        </SegmentHero>

        <div className="container mx-auto px-4">
          <Spine>
            <SpineSection icon={MousePointerClick} tone="text-[#3b82f6]" title="The editor" id="editor">
              <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
                <div>
                  <p className="max-w-xl text-base text-muted-foreground md:text-lg">
                    Canvas, layers and an inspector. Snap to grid, scale and crop any widget, and fire fake follows
                    and raids in demo mode so you can style alerts without begging chat to test them.
                  </p>
                  <p className="mt-4 font-mono text-xs text-muted-foreground/70">Desktop-only for now; mobile editing is on the roadmap.</p>
                </div>
                <ImageSlot label="overlay editor with layers panel and a widget selected" />
              </div>
            </SpineSection>

            <SpineSection icon={Bell} tone="text-[#9e7aff]" title="Templates" id="templates">
              <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
                Start from a template instead of an empty canvas. The catalog lives in the database, so new templates
                show up without an update.
              </p>
              <ul className="mt-6 flex max-w-3xl flex-wrap gap-3">
                {OVERLAY_TEMPLATES.map((name) => (
                  <li key={name} className="rounded-full border border-border bg-card px-4 py-2 font-mono text-xs text-foreground">
                    {name}
                  </li>
                ))}
              </ul>
            </SpineSection>

            <SpineSection icon={Code2} tone="text-[#4ade80]" title="Build your own widgets" id="widgets">
              <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
                <div>
                  <p className="max-w-xl text-base text-muted-foreground md:text-lg">
                    A real code editor in the dashboard. Typed settings fields, test events, state that survives a
                    refresh, and a publish button for the community library when it&apos;s good.
                  </p>
                  <ul className="mt-4 space-y-1.5">
                    <li className="font-mono text-xs text-muted-foreground">Monaco editor with the widget API typed in</li>
                    <li className="font-mono text-xs text-muted-foreground">fire simulated Twitch events while you build</li>
                    <li className="font-mono text-xs text-muted-foreground">publish to the shared widget library</li>
                  </ul>
                </div>
                <ImageSlot label="widget code editor with fields panel open" />
              </div>
            </SpineSection>

            <SpineSection icon={Clapperboard} tone="text-[#3b82f6]" title="Clips widget" density="quiet">
              <p className="max-w-2xl text-base text-muted-foreground">
                Your clip library on stream. Continuous playback that fetches one clip at a time, so it never stalls
                mid-loop.
              </p>
            </SpineSection>

            <SpineSection icon={LibraryBig} tone="text-[#9e7aff]" title="Media library" id="media">
              <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
                Upload alert images, sounds, video loops and Lottie files once, then pick them from any widget&apos;s
                settings.
              </p>
              <ul className="mt-4 space-y-1.5">
                <li className="font-mono text-xs text-muted-foreground">100 MB free · 1 GB with any Cloud OBS plan</li>
                <li className="font-mono text-xs text-muted-foreground">PNG · JPEG · WebP · GIF · AVIF · MP3 · WAV · OGG · MP4 · WebM · Lottie</li>
              </ul>
            </SpineSection>

            <SpineSection icon={KeyRound} tone="text-[#4ade80]" title="Leaked your overlay on stream?" density="quiet">
              <p className="max-w-2xl text-base text-muted-foreground">
                One click resets the overlay key and every open copy goes dark. Refresh the source in OBS and you&apos;re
                back.
              </p>
            </SpineSection>
          </Spine>

          <div className="py-16">
            <DocsBand
              href={`${docsLink}/widgets/overview`}
              label="Widget API reference"
              copy="Fields, state, events and two full recipes. Everything you need to ship a widget."
            />
          </div>
        </div>
      </SignalClockProvider>
    </div>
  );
}
