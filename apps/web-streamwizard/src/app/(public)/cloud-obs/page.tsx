import { Cloud, CreditCard, Gauge, HelpCircle, Layers, MonitorSmartphone, Radio, TabletSmartphone } from "lucide-react";
import type { Metadata } from "next";
import { CloudObsFaq } from "@/components/public/cloud-obs/faq";
import { CloudObsHero } from "@/components/public/cloud-obs/hero";
import { CloudObsPlans } from "@/components/public/pricing/cloud-obs-plans";
import { DocsBand } from "@/components/public/signal/docs-band";
import { ImageSlot } from "@/components/public/signal/image-slot";
import { SignalClockProvider } from "@/components/public/signal/clock";
import { Spine, SpineSection } from "@/components/public/signal/spine";
import { docsLink } from "@/lib/constant";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Cloud OBS",
  description:
    "Stream IRL without a PC. An OBS instance that is yours, SRT and SRTLA ingest, and an auto scene-switcher that swaps scenes before chat notices.",
  alternates: { canonical: absoluteUrl("/cloud-obs") },
};

/* Real fact rows rendered in mono under each feature — product truth, not copy. */
function FactList({ facts }: { facts: string[] }) {
  return (
    <ul className="mt-4 space-y-1.5">
      {facts.map((fact) => (
        <li key={fact} className="font-mono text-xs text-muted-foreground">
          {fact}
        </li>
      ))}
    </ul>
  );
}

export default function CloudObsPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <SignalClockProvider>
        <CloudObsHero />

        <div className="container mx-auto px-4">
          <Spine>
            <SpineSection icon={Cloud} tone="text-[#4ade80]" title="Your own OBS" id="obs">
              <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
                <div>
                  <p className="max-w-xl text-base text-muted-foreground md:text-lg">
                    A full OBS that belongs to you, running in a browser tab. Scenes, sources and settings persist
                    between sessions, so the setup you built last stream is the setup you open next time. Nothing runs
                    on your end but the phone.
                  </p>
                  <FactList
                    facts={[
                      "720p30 · 1080p30 · 1080p60 output, set by plan",
                      "the real OBS, not a cut-down remote",
                      "scenes and settings persist between sessions",
                      "upload your media straight into it",
                    ]}
                  />
                </div>
                <ImageSlot label="cloud OBS viewer with a scene loaded, from /dashboard/irl/obs" />
              </div>
            </SpineSection>

            <SpineSection icon={Radio} tone="text-[#3b82f6]" title="Bonded ingest" id="ingest">
              <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
                Our ingest nodes take your phone&apos;s feed over SRT or SRTLA and hand it straight to your cloud OBS. Link
                stats every second. Rotate a leaked key in one click.
              </p>
              <FactList
                facts={[
                  "SRT :8888 · SRTLA :5000 (bonds multiple connections)",
                  "bitrate, RTT and packet loss measured once a second",
                  "stream-key auth with one-click rotation",
                ]}
              />
            </SpineSection>

            <SpineSection icon={Gauge} tone="text-[#9e7aff]" title="Auto scene-switcher" id="auto-switcher">
              <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
                <div>
                  <p className="max-w-xl text-base text-muted-foreground md:text-lg">
                    When the connection degrades it switches to your low-bitrate scene. When it dies, to
                    connection-lost. When it is genuinely stable again, back. You keep streaming instead of watching
                    graphs.
                  </p>
                  <FactList
                    facts={[
                      "sensitivity presets: relaxed · balanced · fast",
                      "manual override with automatic expiry",
                      "optional chat notices when scenes change",
                      "optional auto stop-stream on long outages",
                      "scenes tracked by id, so renaming never breaks it",
                    ]}
                  />
                </div>
                <ImageSlot label="auto-switcher settings card with the three presets visible" />
              </div>
            </SpineSection>

            <SpineSection icon={TabletSmartphone} tone="text-[#3b82f6]" title="The deck" id="deck">
              <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
                <div>
                  <p className="max-w-xl text-base text-muted-foreground md:text-lg">
                    A remote for your cloud OBS, built for one thumb while the other hand holds the gimbal. Scenes,
                    chat, stream info and switcher sensitivity, on the phone already in your pocket.
                  </p>
                  <FactList
                    facts={[
                      "add it to your home screen and it opens like an app",
                      "four tabs: deck · chat · stream info · sensitivity",
                      "go live and end stream from the street",
                      "tapping a scene holds the auto-switcher until you release it",
                    ]}
                  />
                </div>
                <ImageSlot label="deck on a phone: scene tiles + feed health strip" ratio="9/16" className="max-w-[240px] justify-self-center lg:justify-self-start" />
              </div>
            </SpineSection>

            <SpineSection icon={Layers} tone="text-[#4ade80]" title="IRL overlays" id="overlays">
              <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
                Overlays that read your phone&apos;s GPS and render on the outgoing video. Walking stats is the ready-made
                one: speed, distance, location and weather along the bottom, every module on its own switch. Build your
                own in the same editor from speed, heading, altitude and position fields.
              </p>
              <FactList
                facts={[
                  "walking stats template: speed · distance · location · weather",
                  "distance resets with your stream, server-side, even if OBS wasn't open",
                  "GPS tracks auto-delete after 30 days",
                ]}
              />
              <p className="mt-4 max-w-2xl font-mono text-xs text-muted-foreground">
                Treat the overlay URL like a password: it is a live feed of where you are.
              </p>
            </SpineSection>

            <SpineSection icon={MonitorSmartphone} tone="text-[#9e7aff]" title="Switcher monitor" id="switcher-monitor">
              <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
                <div>
                  <p className="max-w-xl text-base text-muted-foreground md:text-lg">
                    Out filming, you cannot see your OBS. The monitor puts the switcher on your phone&apos;s preview
                    instead: which scene viewers are on, which metric is going bad, and how many seconds you have
                    before the scene changes. It renders on your screen only, never in the video you send.
                  </p>
                  <FactList
                    facts={[
                      "one bar per metric: bitrate · RTT · packet loss",
                      "countdown to the switch, and to the switch back",
                      "stays up a few seconds after recovery, so you see you made it",
                      "when all is well: a small scene chip, or nothing at all",
                      "sized for a phone at arm's length, colors are yours",
                    ]}
                  />
                </div>
                <ImageSlot label="IRL Pro preview with the switcher status card mid-degrade" ratio="9/16" className="max-w-[240px] justify-self-center lg:justify-self-start" />
              </div>
            </SpineSection>
            <SpineSection icon={CreditCard} tone="text-[#4ade80]" title="What it costs" id="pricing">
              <CloudObsPlans />
            </SpineSection>

            <SpineSection icon={HelpCircle} tone="text-[#3b82f6]" title="Questions people actually ask" id="faq">
              <CloudObsFaq />
            </SpineSection>
          </Spine>

          <div className="py-16">
            <DocsBand
              href={`${docsLink}/irl/overview`}
              label="Read the setup guide"
              copy="The full setup lives in the docs: IRL Pro on Android, ingest keys, scene templates."
            />
          </div>
        </div>
      </SignalClockProvider>
    </div>
  );
}
