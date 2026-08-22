import { TrackedLink } from "@/components/public/analytics/tracked-link";
import { SectionView } from "@/components/public/analytics/section-view";
import { docsLink } from "@/lib/constant";
import { Reveal } from "@/components/public/home/reveal";
import { IrlOverlayDemo } from "@/components/public/home/irl-overlay-demo";
import { OverlayWidgetCards } from "@/components/public/home/overlay-widget-cards";
import { DemoAlertProvider } from "@/components/public/home/overlay-demo-alert";

/*
 * The overlays section as it reads for IRL: the phone's GPS on stream as
 * speed, distance, city, and weather, which is the part nobody else does. The
 * widget library underneath is the same one the landing page shows.
 */

const TEMPLATES = [
  "Walking stats",
  "Auto switcher monitor",
  "Starting soon",
  "Just chatting",
  "Clips showcase",
  "Alert box",
];

export function IrlOverlaysSection() {
  return (
    <section className="py-20">
      <SectionView section="irl_overlays" className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Overlays that know where you are.</h2>
          <p className="mt-4 text-muted-foreground">
            Alerts, clips, countdowns, and live GPS stats from your phone, all on one browser source. Build it in the
            editor, paste one URL into cloud OBS.
          </p>
        </div>

        <DemoAlertProvider>
          <Reveal direction="scale">
            <IrlOverlayDemo />
          </Reveal>

          <Reveal className="mt-16">
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              The rest of the widget library
            </p>
            <OverlayWidgetCards irlLink={false} />
          </Reveal>
        </DemoAlertProvider>

        <Reveal>
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              Start from a template: <span className="text-foreground">{TEMPLATES.join(" · ")}</span>. Or from a blank
              1920×1080 canvas.
            </p>
            <p className="text-sm text-muted-foreground">
              Same editor, same widgets, in the OBS on your PC too.{" "}
              <TrackedLink
                href={`${docsLink}/overlays/overview`}
                cta="read_overlay_docs"
                section="irl_overlays"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-300 transition-colors hover:text-purple-200"
              >
                Read the overlay docs
              </TrackedLink>
            </p>
          </div>
        </Reveal>
      </SectionView>
    </section>
  );
}
