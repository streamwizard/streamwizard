"use client";

import { Button } from "@repo/ui";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui";
import type { RootOverlayItemType } from "@/types/overlays";
import { LayoutGrid, Plus } from "lucide-react";
import { groupLibraryWidgetsByCategory } from "../registry/overlay-widget-registry";
import type { WidgetCategory } from "../registry/overlay-widget-registry.types";

const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  media: "Media",
  alerts: "Alerts",
  layout: "Layout",
  other: "Other",
};

interface OverlayWidgetSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddWidget: (type: RootOverlayItemType) => void;
}

export function OverlayWidgetSheet({
  open,
  onOpenChange,
  onAddWidget,
}: OverlayWidgetSheetProps) {
  const byCategory = groupLibraryWidgetsByCategory();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md flex flex-col">
        <SheetHeader className="text-left shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Widget library
          </SheetTitle>
          <SheetDescription>
            Add root widgets to the scene. Nested items can be managed from the
            layers panel.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
          {(Object.keys(CATEGORY_LABELS) as WidgetCategory[]).map((category) => {
            const defs = byCategory[category];
            if (defs.length === 0) return null;
            return (
              <section key={category}>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  {CATEGORY_LABELS[category]}
                </h4>
                <div className="space-y-2">
                  {defs.map((def) => {
                    const title = def.library?.title ?? def.type;
                    return (
                      <Button
                        key={def.type}
                        variant="outline"
                        className="w-full h-auto justify-start gap-2 py-3 flex-col items-stretch text-left whitespace-normal"
                        type="button"
                        onClick={() =>
                          onAddWidget(def.type as RootOverlayItemType)
                        }
                      >
                        <span className="flex items-center w-full min-w-0">
                          <Plus className="h-4 w-4 mr-2 shrink-0" />
                          <span className="font-medium text-left min-w-0 wrap-break-word">
                            {title}
                          </span>
                        </span>
                        {def.library?.description ? (
                          <span className="block w-full min-w-0 pl-6 text-xs font-normal text-muted-foreground text-left wrap-break-word leading-snug">
                            {def.library.description}
                          </span>
                        ) : null}
                      </Button>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <section>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Coming soon
            </h4>
            <p className="text-xs text-muted-foreground">
              More categories and widgets will appear here as they are added to
              the registry.
            </p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
