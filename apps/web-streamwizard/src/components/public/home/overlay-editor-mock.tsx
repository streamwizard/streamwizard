import { Bell, Clapperboard, MapPin, Timer } from "lucide-react";

/*
 * A miniature of the overlay editor: canvas with a selected widget, the layer
 * list, and a hint of the custom-widget code editor. Static sketch in the
 * editor's visual grammar, marked decorative.
 */

const layers = [
  { icon: Bell, name: "Alerts" },
  { icon: Clapperboard, name: "Clips rotator", active: true },
  { icon: Timer, name: "Countdown" },
  { icon: MapPin, name: "GPS stats" },
];

export function OverlayEditorMock() {
  return (
    <div
      className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 sm:p-4"
      role="img"
      aria-label="Sketch of the overlay editor: a canvas with a selected clips widget, a layer list, and a custom widget code snippet"
    >
      <div aria-hidden="true" className="flex gap-3">
        {/* Canvas */}
        <div className="relative aspect-video min-w-0 flex-1 overflow-hidden rounded-lg border border-white/[0.07] bg-black">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />
          {/* Selected widget */}
          <div className="absolute left-[8%] top-[12%] w-[46%] rounded border-2 border-dashed border-purple-400/80 bg-purple-500/10 p-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-purple-300">
              Rotating clips
            </p>
            <div className="mt-1.5 aspect-video rounded bg-linear-to-br from-purple-500/25 to-slate-900/60" />
            <span className="absolute -left-1 -top-1 h-2 w-2 border border-purple-400 bg-background" />
            <span className="absolute -right-1 -top-1 h-2 w-2 border border-purple-400 bg-background" />
            <span className="absolute -bottom-1 -left-1 h-2 w-2 border border-purple-400 bg-background" />
            <span className="absolute -bottom-1 -right-1 h-2 w-2 border border-purple-400 bg-background" />
          </div>
          {/* Alert widget placeholder */}
          <div className="absolute bottom-[10%] right-[6%] rounded border border-white/[0.15] bg-white/[0.05] px-2 py-1 font-mono text-[10px] text-muted-foreground">
            night_owl_kat followed
          </div>
        </div>

        {/* Layer rail */}
        <div className="flex w-32 shrink-0 flex-col gap-1.5 sm:w-36">
          <p className="px-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Layers
          </p>
          {layers.map(({ icon: Icon, name, active }) => (
            <div
              key={name}
              className={
                "flex items-center gap-1.5 truncate rounded-md border px-2 py-1.5 text-xs " +
                (active
                  ? "border-purple-500/50 bg-purple-500/10 text-purple-300"
                  : "border-white/[0.07] bg-white/[0.03] text-muted-foreground")
              }
            >
              <Icon className="h-3 w-3 shrink-0" />
              {name}
            </div>
          ))}
          <div className="mt-1 truncate rounded-md border border-white/[0.07] bg-black/50 px-2 py-1.5 font-mono text-[10px] text-green-400/80">
            {'<div class="alert">'}
          </div>
        </div>
      </div>
    </div>
  );
}
