"use client";

import { Button, cn } from "@repo/ui";
import { LayoutGrid, Loader2, SlidersHorizontal } from "lucide-react";
import type { SaveBarState } from "./_switcher-settings-panel";

export type DeckTab = "deck" | "switcher";

// Single fixed stack at the bottom of the deck: the save bar sits directly on
// top of the tab bar, so neither needs to know the other's height. The whole
// stack carries the bottom safe-area inset (iOS gesture bar, Android nav bar).

const TABS: { value: DeckTab; label: string; Icon: typeof LayoutGrid }[] = [
  { value: "deck", label: "Deck", Icon: LayoutGrid },
  { value: "switcher", label: "Sensitivity", Icon: SlidersHorizontal },
];

interface DeckFooterProps {
  tab: DeckTab;
  onTabChange: (next: DeckTab) => void;
  /** Null on the deck tab, or when the switcher form has nothing to save. */
  saveBar: SaveBarState | null;
  onSave: () => void;
  onDiscard: () => void;
}

export function DeckFooter({ tab, onTabChange, saveBar, onSave, onDiscard }: DeckFooterProps) {
  const showSaveBar = saveBar != null && (saveBar.dirty || saveBar.submitting);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
      {showSaveBar ? (
        <div className="border-t bg-card/95 px-4 py-3 backdrop-blur motion-safe:animate-in motion-safe:slide-in-from-bottom-2">
          <div className="mx-auto flex w-full max-w-md items-center gap-3">
            <p className={cn("min-w-0 flex-1 text-xs", saveBar.hasErrors ? "text-destructive" : "text-muted-foreground")}>
              {saveBar.hasErrors ? "Fix the highlighted settings." : "Unsaved changes."}
            </p>
            <Button
              type="button"
              variant="ghost"
              className="h-11 rounded-xl"
              onClick={onDiscard}
              disabled={saveBar.submitting}
            >
              Discard
            </Button>
            <Button type="button" className="h-11 rounded-xl px-6" onClick={onSave} disabled={saveBar.submitting}>
              {saveBar.submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      ) : null}

      <nav aria-label="Deck sections" className="border-t bg-card/95 backdrop-blur">
        <div className="mx-auto grid w-full max-w-md grid-cols-2">
          {TABS.map(({ value, label, Icon }) => {
            const active = value === tab;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onTabChange(value)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-16 flex-col items-center justify-center gap-1 transition-colors active:bg-accent",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {active ? <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary" /> : null}
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/** Bottom padding for <main> so nothing hides behind the fixed footer. */
export function deckMainPadding(showSaveBar: boolean) {
  // Underscores are Tailwind's escape for the spaces calc() requires around `+`.
  return showSaveBar
    ? "pb-[calc(9.5rem_+_env(safe-area-inset-bottom))]"
    : "pb-[calc(5.5rem_+_env(safe-area-inset-bottom))]";
}
