"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, ChevronUp, FlaskConical, MoreHorizontal, X } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  TooltipProvider,
} from "@repo/ui";
import { cn } from "@/lib/utils";
import {
  AdsSection,
  AlertsSection,
  CreditsSection,
  CustomEventSection,
  FireModeSwitch,
  PollSection,
  SimulateSection,
} from "./demo-sections";
import {
  ALL_SECTION_IDS,
  ALL_SIMULATOR_IDS,
  DEMO_SECTIONS,
  demoRelevance,
  type DemoSectionId,
} from "./demo-relevance";
import { useDemoPanel, type UseDemoPanelOptions } from "./use-demo-panel";

export interface DemoDeckProps extends UseDemoPanelOptions {
  open: boolean;
  onClose: () => void;
  /** Item types on the canvas, so the deck only offers tests something here can show. */
  widgetTypes: readonly string[];
}

/**
 * The overlay editor's test deck: one card floating over the canvas instead of
 * a stack of rows pushing it down. Tabs are picked from what the canvas holds,
 * so a scene with only an alert box shows Alerts and the picker, not six rows.
 *
 * Kept mounted while closed (the host hides it) so looping simulators keep
 * running and the picker keeps its state.
 */
export function DemoDeck({ open, onClose, widgetTypes, ...options }: DemoDeckProps) {
  const panel = useDemoPanel(options);
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const tabRefs = useRef(new Map<DemoSectionId, HTMLButtonElement>());

  const relevance = useMemo(
    () => demoRelevance(widgetTypes, panel.detected),
    [widgetTypes, panel.detected]
  );

  // A simulator stays listed while it runs, even after its widget is deleted:
  // otherwise there'd be nothing left to press Stop on.
  const simulatorIds = useMemo(() => {
    const base = showAll ? ALL_SIMULATOR_IDS : relevance.simulatorIds;
    return [...base, ...panel.runningIds.filter((id) => !base.includes(id))];
  }, [showAll, relevance.simulatorIds, panel.runningIds]);

  const visible = useMemo(() => {
    const ids = new Set<DemoSectionId>(showAll ? ALL_SECTION_IDS : relevance.sections);
    if (panel.runningIds.length > 0) ids.add("simulate");
    return DEMO_SECTIONS.filter((s) => ids.has(s.id));
  }, [showAll, relevance.sections, panel.runningIds.length]);

  const active: DemoSectionId =
    visible.find((s) => s.id === panel.tab)?.id ?? visible[0]?.id ?? "custom";
  const hiddenCount = DEMO_SECTIONS.length - relevance.sections.length;
  const running = panel.runningIds.length;
  const live = panel.effectiveMode === "live";

  function onTabKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = visible.findIndex((s) => s.id === active);
    const next = visible[(i + (e.key === "ArrowRight" ? 1 : -1) + visible.length) % visible.length];
    if (!next) return;
    panel.setTab(next.id);
    tabRefs.current.get(next.id)?.focus();
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center px-3",
          !open && "hidden"
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand the demo panel"
            className="pointer-events-auto flex h-8 items-center gap-2 rounded-full border border-border bg-popover/95 px-3 text-xs shadow-lg backdrop-blur transition-colors hover:bg-accent"
          >
            <FlaskConical className="size-3.5 text-muted-foreground" aria-hidden />
            Demo
            {running > 0 && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <RunningDot />
                {running} running
              </span>
            )}
            {live && <span className="rounded bg-primary/15 px-1.5 text-[10px] leading-4 text-primary">Live</span>}
            <ChevronUp className="size-3.5 text-muted-foreground" aria-hidden />
          </button>
        ) : (
          <section
            aria-label="Demo events"
            className="pointer-events-auto w-full max-w-[760px] overflow-hidden rounded-xl border border-border bg-popover/95 text-popover-foreground shadow-xl backdrop-blur"
          >
            <header className="flex h-11 items-center gap-2 border-b border-border px-2">
              <FlaskConical className="ml-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />

              <div
                role="tablist"
                aria-label="Demo sections"
                onKeyDown={onTabKey}
                className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]"
              >
                {visible.map((s) => {
                  const selected = s.id === active;
                  return (
                    <button
                      key={s.id}
                      ref={(el) => {
                        if (el) tabRefs.current.set(s.id, el);
                        else tabRefs.current.delete(s.id);
                      }}
                      type="button"
                      role="tab"
                      id={`demo-tab-${s.id}`}
                      aria-selected={selected}
                      aria-controls="demo-deck-body"
                      tabIndex={selected ? 0 : -1}
                      onClick={() => panel.setTab(s.id)}
                      className={cn(
                        "flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors",
                        selected
                          ? "bg-accent font-medium text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {s.label}
                      {s.id === "simulate" && running > 0 && (
                        <span className="flex items-center gap-1 tabular-nums text-primary">
                          <RunningDot />
                          {running}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 shrink-0"
                    aria-label="Demo panel options"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Tabs follow the widgets on this canvas.
                  </DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={showAll}
                    onCheckedChange={(v) => setShowAll(Boolean(v))}
                    className="text-xs"
                  >
                    Show every test
                    {!showAll && hiddenCount > 0 && (
                      <span className="ml-auto text-muted-foreground">+{hiddenCount}</span>
                    )}
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <FireModeSwitch panel={panel} className="shrink-0" />

              <div className="flex shrink-0 items-center">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7"
                  onClick={() => setCollapsed(true)}
                  aria-label="Minimise the demo panel"
                  title="Minimise"
                >
                  <ChevronDown className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7"
                  onClick={onClose}
                  aria-label="Close the demo panel"
                  title={running > 0 ? "Close (simulators keep running)" : "Close"}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </header>

            <div
              id="demo-deck-body"
              role="tabpanel"
              aria-labelledby={`demo-tab-${active}`}
              className="max-h-[45vh] overflow-y-auto px-3 py-3"
            >
              {active === "alerts" && <AlertsSection panel={panel} />}
              {active === "poll" && <PollSection panel={panel} />}
              {active === "ads" && <AdsSection panel={panel} />}
              {active === "credits" && <CreditsSection panel={panel} />}
              {active === "simulate" && <SimulateSection panel={panel} simulatorIds={simulatorIds} />}
              {active === "custom" && (
                <CustomEventSection
                  panel={panel}
                  note={
                    relevance.nothingToTest && !showAll
                      ? "Add an alert box, poll, ad or credits widget and its quick tests show up here."
                      : undefined
                  }
                />
              )}
            </div>
          </section>
        )}
      </div>
    </TooltipProvider>
  );
}

function RunningDot() {
  return (
    <span className="relative flex size-1.5" aria-hidden>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
      <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
    </span>
  );
}
