"use client";

import { useEffect } from "react";
import { Copy, MoreHorizontal, Pencil, Play, Plus, Trash2 } from "lucide-react";
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Switch,
} from "@repo/ui";
import {
  ALERT_EVENT_LABELS,
  ALERT_VARIATION_LIMITS,
  alertVariationSummary,
  type AlertEventType,
  type AlertVariation,
} from "@repo/ui/overlay";
import { InspectorSection, SwitchField } from "@/components/overlays/inspector-fields";

export interface AlertVariationListProps {
  /** Scopes the row ids, so two alert boxes never share one. */
  itemId: string;
  event: AlertEventType;
  variations: AlertVariation[];
  randomPick: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The variation just left: its row takes focus back. */
  returnTo: string | null;
  testBusy: boolean;
  onEdit: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onTest: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onAddFromAlert: () => void;
  onAddFromCopy: () => void;
  onRandomPickChange: (randomPick: boolean) => void;
}

const rowId = (itemId: string, event: AlertEventType, id: string) =>
  `alert-variation-${itemId}-${event}-${id}`;

/**
 * An alert's variations: the versions of it that play instead when their
 * condition is met. Each row says in plain words when that is, so the list
 * reads as the rules the alert follows.
 */
export function AlertVariationList({
  itemId,
  event,
  variations,
  randomPick,
  open,
  onOpenChange,
  returnTo,
  testBusy,
  onEdit,
  onToggle,
  onTest,
  onDuplicate,
  onDelete,
  onAddFromAlert,
  onAddFromCopy,
  onRandomPickChange,
}: AlertVariationListProps) {
  const full = variations.length >= ALERT_VARIATION_LIMITS.perAlert;
  const alertLabel = ALERT_EVENT_LABELS[event];

  useEffect(() => {
    if (returnTo) {
      document.getElementById(rowId(itemId, event, returnTo))?.focus({ preventScroll: true });
    }
    // Only on the way back in: the row to return to is fixed for this mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <InspectorSection
      title={variations.length ? `Variations (${variations.length})` : "Variations"}
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="space-y-3">
        {variations.length === 0 ? (
          <p className="text-xs leading-snug text-muted-foreground">
            A variation plays instead of this alert when its condition is met. A louder one for a
            big number, or one for a single viewer.
          </p>
        ) : (
          <ul className="-mx-2">
            {variations.map((variation) => (
              <li
                key={variation.id}
                className="relative flex min-h-12 items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60 has-[[data-open]:focus-visible]:ring-2 has-[[data-open]:focus-visible]:ring-ring"
              >
                <Switch
                  aria-label={`${variation.name} variation`}
                  className="relative z-10"
                  checked={variation.enabled}
                  onCheckedChange={(v) => onToggle(variation.id, v)}
                />
                {/* The button's ::after covers the row, so the whole row opens
                    the variation while the switch, play and menu stay their
                    own controls on top of it. */}
                <button
                  type="button"
                  id={rowId(itemId, event, variation.id)}
                  data-open=""
                  onClick={() => onEdit(variation.id)}
                  className="min-w-0 flex-1 text-left outline-none after:absolute after:inset-0"
                >
                  <span
                    className={cn(
                      "block truncate text-sm",
                      !variation.enabled && "text-muted-foreground"
                    )}
                  >
                    {variation.name}
                  </span>
                  <span className="block text-xs leading-snug text-muted-foreground">
                    {alertVariationSummary(event, variation)}
                  </span>
                  <span className="sr-only">
                    {variation.enabled ? "On" : "Off"}. Open settings.
                  </span>
                </button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="relative z-10 size-7"
                  disabled={testBusy}
                  aria-label={`Test the ${variation.name} variation`}
                  title="Plays this variation, whatever its condition"
                  onClick={() => onTest(variation.id)}
                >
                  <Play className="size-3.5" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="relative z-10 size-7"
                      aria-label={`More for the ${variation.name} variation`}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onEdit(variation.id)}>
                      <Pencil />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={full} onSelect={() => onDuplicate(variation.id)}>
                      <Copy />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => onDelete(variation.id)}>
                      <Trash2 />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full" disabled={full}>
              <Plus />
              Add variation
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuItem onSelect={onAddFromAlert}>
              Start from the {alertLabel} alert
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onAddFromCopy}>
              Copy another alert or variation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {full ? (
          <p className="text-xs leading-snug text-muted-foreground">
            That is the most one alert can have ({ALERT_VARIATION_LIMITS.perAlert}). Delete one to
            add another.
          </p>
        ) : null}

        {variations.length > 1 ? (
          <SwitchField
            id={`alert-random-pick-${itemId}-${event}`}
            label="Pick at random when several match"
            checked={randomPick}
            hint="When more than one variation has the same condition, a random one plays each time. Off, the first in the list always wins. Use it to rotate a few alerts on one condition."
            onCheckedChange={onRandomPickChange}
          />
        ) : null}
      </div>
    </InspectorSection>
  );
}
