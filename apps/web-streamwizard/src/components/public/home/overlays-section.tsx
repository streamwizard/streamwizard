import { Bell, Code2, Layers, MapPin } from "lucide-react";
import { Reveal } from "./reveal";
import { OverlayEditorMock } from "./overlay-editor-mock";

/*
 * Overlays are their own pillar: they work in your own OBS just as well as
 * in cloud OBS. Centered composition so the section reads differently from
 * the split rows above it.
 */

const features = [
  {
    icon: Bell,
    title: "Alert box, your media",
    body: "Follow, sub, cheer, and raid alerts with your own images, videos, and sounds. No code needed.",
  },
  {
    icon: Layers,
    title: "A real editor",
    body: "Canvas with layers, snapping, and drag to resize. Rotating clips, countdowns, clocks, and text.",
  },
  {
    icon: MapPin,
    title: "Built for IRL too",
    body: "Live GPS walking stats like speed and altitude, made for outside streams on cloud OBS.",
  },
  {
    icon: Code2,
    title: "Custom widgets",
    body: "Write your own in HTML, JavaScript, and Tailwind, with a live preview while you type.",
  },
];

export function OverlaysSection() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Overlays for any OBS.</h2>
          <p className="mt-4 text-muted-foreground">
            The overlay editor works with the OBS on your PC and with cloud OBS. Build it once, add
            one browser source, done.
          </p>
        </div>

        <Reveal>
          <div className="mx-auto max-w-3xl">
            <OverlayEditorMock />
          </div>
        </Reveal>

        <Reveal>
          <div className="mx-auto mt-12 grid max-w-4xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-purple-400" aria-hidden="true" />
                  <h3 className="text-sm font-semibold">{title}</h3>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
