"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import {
  ALERT_EVENT_CATEGORIES,
  ALERT_EVENT_LABELS,
  alertPresentationOf,
  alertVariationSummary,
  type AlertPresentation,
  type AlertWidgetItemConfig,
} from "@repo/ui/overlay";

export interface AlertCopySourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cfg: AlertWidgetItemConfig;
  onPick: (settings: AlertPresentation) => void;
}

const ROW =
  "flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

/**
 * Picks whose settings a new variation starts from: any alert on this box, or
 * any variation of one. A copy, not a link -- nothing follows the source
 * afterwards.
 */
export function AlertCopySourceDialog({ open, onOpenChange, cfg, onPick }: AlertCopySourceDialogProps) {
  const pick = (settings: AlertPresentation) => {
    onPick(alertPresentationOf(settings));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-md flex-col">
        <DialogHeader>
          <DialogTitle>Copy from</DialogTitle>
          <DialogDescription>
            The new variation starts with this one&apos;s text, media, sound and style. After that
            they are separate: changing one does not change the other.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-2 min-h-0 flex-1 space-y-4 overflow-y-auto px-2">
          {ALERT_EVENT_CATEGORIES.map((category) => (
            <div key={category.id}>
              <h4 className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {category.label}
              </h4>
              <ul>
                {category.events.map((event) => {
                  const variant = cfg.variants[event];
                  return (
                    <li key={event}>
                      <button type="button" className={ROW} onClick={() => pick(variant)}>
                        <span className="text-sm">{ALERT_EVENT_LABELS[event]}</span>
                      </button>
                      {variant.variations.length ? (
                        <ul className="ml-4 border-l pl-2">
                          {variant.variations.map((variation) => (
                            <li key={variation.id}>
                              <button
                                type="button"
                                className={ROW}
                                onClick={() => pick(variation.settings)}
                              >
                                <span className="shrink-0 text-sm">{variation.name}</span>
                                <span className="min-w-0 truncate text-xs text-muted-foreground">
                                  {alertVariationSummary(event, variation)}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
