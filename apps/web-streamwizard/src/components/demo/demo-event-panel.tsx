"use client";

import { useMemo } from "react";
import { TooltipProvider } from "@repo/ui";
import { WIDGET_SIMULATORS } from "@repo/ui/overlay";
import { cn } from "@/lib/utils";
import {
  AlertsSection,
  CustomEventSection,
  FireModeSwitch,
  PollSection,
  SimulateSection,
} from "./demo-sections";
import { useDemoPanel, type UseDemoPanelOptions } from "./use-demo-panel";

export interface DemoEventPanelProps extends UseDemoPanelOptions {
  className?: string;
}

/**
 * The widget editor's demo strip. A custom widget is what's being tested, so
 * the picker and simulators lead; the canvas-only tests (ad schedule, credits)
 * belong to the overlay editor's deck.
 */
const STRIP_SECTIONS = [
  { id: "custom", label: "Event" },
  { id: "simulate", label: "Simulate" },
  { id: "alerts", label: "Alerts" },
  { id: "poll", label: "Poll" },
] as const;

type StripSectionId = (typeof STRIP_SECTIONS)[number]["id"];

export function DemoEventPanel({ className, ...options }: DemoEventPanelProps) {
  const panel = useDemoPanel(options);
  const active: StripSectionId =
    STRIP_SECTIONS.find((s) => s.id === panel.tab)?.id ?? "custom";
  const simulatorIds = useMemo(() => Object.keys(WIDGET_SIMULATORS), []);
  const running = panel.runningIds.length;

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("shrink-0 border-b bg-background", className)}>
        <div className="flex h-9 items-center gap-2 border-b border-border/50 px-2">
          <div role="tablist" aria-label="Demo sections" className="flex items-center gap-0.5">
            {STRIP_SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === active}
                onClick={() => panel.setTab(s.id)}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors",
                  s.id === active
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s.label}
                {s.id === "simulate" && running > 0 && (
                  <span className="tabular-nums text-primary">{running}</span>
                )}
              </button>
            ))}
          </div>
          <FireModeSwitch panel={panel} className="ml-auto" />
        </div>

        <div role="tabpanel" className="px-3 py-2">
          {active === "custom" && <CustomEventSection panel={panel} />}
          {active === "simulate" && <SimulateSection panel={panel} simulatorIds={simulatorIds} />}
          {active === "alerts" && <AlertsSection panel={panel} />}
          {active === "poll" && <PollSection panel={panel} />}
        </div>
      </div>
    </TooltipProvider>
  );
}
