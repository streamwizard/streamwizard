"use client";

import { useState } from "react";
import { Smartphone, Wifi, MapPin, ShieldCheck, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: Smartphone,
    title: "Generate a collector URL",
    description:
      "Create a unique URL for each device you want to stream GPS from — typically your phone. Give it a name so you can identify it later.",
  },
  {
    icon: MapPin,
    title: "Open the URL in IRL Pro",
    description:
      "Paste the URL into the IRL Pro app as a browser source. The page will acquire GPS and stream your location to StreamWizard in real time — no login required.",
  },
  {
    icon: Wifi,
    title: "Add IRL widgets to your overlay",
    description:
      "Open the Overlay Editor and add IRL widgets (speed, heading, altitude, etc.) to your scene. They update live whenever your phone is connected.",
  },
  {
    icon: ShieldCheck,
    title: "Revoke access anytime",
    description:
      "Each device gets its own unique token baked into the URL. Delete a device to immediately revoke its access — the URL stops working instantly.",
  },
];

export function IrlSetupGuide({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            How it works
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 border-t">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-4">
            {steps.map(({ icon: Icon, title, description }, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground/50">{i + 1}</span>
                    <p className="text-sm font-semibold leading-tight">{title}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed pl-10">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
