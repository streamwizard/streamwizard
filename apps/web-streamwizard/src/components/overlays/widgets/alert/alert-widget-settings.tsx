"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { useDemoFire } from "@/hooks/overlays/use-demo-fire";
import {
  ALERT_EVENT_LABELS,
  ALERT_EVENT_SUBSCRIPTION_TYPES,
  ALERT_VARIATION_LIMITS,
  alertVariationParameters,
  applyAlertLookToAll,
  createAlertVariation,
  normalizeAlertWidgetConfig,
  type AlertEventCategoryId,
  type AlertEventType,
  type AlertPresentation,
  type AlertVariantConfig,
  type AlertVariation,
  type AlertWidgetItemConfig,
} from "@repo/ui/overlay";
import { useModKeyLabel } from "@/components/overlays/editor/use-mod-key";
import { AlertCopySourceDialog } from "./alert-copy-source-dialog";
import { AlertDetail } from "./alert-detail";
import { AlertList } from "./alert-list";
import { AlertVariationEditor, type AlertVariationGroup } from "./alert-variation-editor";
import { AlertVariationList } from "./alert-variation-list";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";

export function AlertWidgetSettings(props: OverlayInspectorAppendProps) {
  // Keyed on the widget: picking another alert box starts on its list, not on
  // whichever alert the last one had open.
  return <AlertSettingsPanel key={props.item.id} {...props} />;
}

/** Which of the panel's screens is showing. */
type View =
  | { screen: "list" }
  | { screen: "alert"; event: AlertEventType }
  | {
      screen: "variation";
      event: AlertEventType;
      id: string;
      /** The alert's variations as they were when this opened: what Cancel puts back. */
      snapshot: AlertVariation[];
    };

type PanelGroup = AlertVariationGroup | "variations";

function newVariationId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The alert box's panel is up to three screens deep: the list of every alert,
 * one alert on its own, and one of that alert's variations. Twenty-three
 * alerts with twenty-odd settings each do not fit one column, so each screen
 * answers one question and the fields only show once their owner is picked.
 */
function AlertSettingsPanel({ item, updateItem }: OverlayInspectorAppendProps) {
  const cfg = normalizeAlertWidgetConfig(item.config);
  const [category, setCategory] = useState<AlertEventCategoryId>("community");
  const [view, setView] = useState<View>({ screen: "list" });
  // Which way the last move went, for the slide. Null until there has been
  // one, which keeps the panel's first appearance still.
  const [direction, setDirection] = useState<"in" | "out" | null>(null);
  // The rows to hand focus back to on the way out of a screen.
  const [returnEvent, setReturnEvent] = useState<AlertEventType | null>(null);
  const [returnVariation, setReturnVariation] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<PanelGroup, boolean>>({
    text: true,
    typography: false,
    media: true,
    timing: false,
    animation: false,
    textAnimation: false,
    variations: true,
    condition: true,
  });
  const [copyFor, setCopyFor] = useState<AlertEventType | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const { mode, fire } = useDemoFire();
  const reduceMotion = useReducedMotion();
  const mod = useModKeyLabel();

  const setGroup = (group: PanelGroup, open: boolean) =>
    setOpenGroups((prev) => ({ ...prev, [group]: open }));

  function go(next: View, way: "in" | "out") {
    setDirection(way);
    setView(next);
  }

  function patchConfig(updates: Partial<AlertWidgetItemConfig>) {
    updateItem(item.id, { config: { ...cfg, ...updates } });
  }

  function patchVariant(event: AlertEventType, updates: Partial<AlertVariantConfig>) {
    patchConfig({
      variants: {
        ...cfg.variants,
        [event]: { ...cfg.variants[event], ...updates },
      },
    });
  }

  function patchVariation(event: AlertEventType, id: string, updates: Partial<AlertVariation>) {
    patchVariant(event, {
      variations: cfg.variants[event].variations.map((v) =>
        v.id === id ? { ...v, ...updates } : v
      ),
    });
  }

  async function fireTest(event: AlertEventType, variationId?: string) {
    // Same path the demo bar's buttons take, so Local/Live means the same thing
    // in both places and this panel needs no live switch of its own.
    // It warns on its own when nothing on the scene would play the alert, so a
    // switched-off one never reads as a broken button.
    setTestBusy(true);
    await fire({
      ...ALERT_EVENT_SUBSCRIPTION_TYPES[event],
      // A variation is tested as itself, whatever its condition says.
      forceVariation: variationId ? { itemId: item.id, variationId } : undefined,
    });
    setTestBusy(false);
  }

  function copyLookToAll(event: AlertEventType) {
    // One write, so one undo step puts every alert back.
    updateItem(item.id, { config: applyAlertLookToAll(cfg, event) });
    toast(`Every alert now looks like ${ALERT_EVENT_LABELS[event]}.`, {
      id: "alert-look-copied",
      description: `${mod}+Z puts it back.`,
    });
  }

  /** Adds a variation looking like `settings` and opens it. Cancel there removes it again. */
  function addVariation(event: AlertEventType, settings: AlertPresentation) {
    const existing = cfg.variants[event].variations;
    if (existing.length >= ALERT_VARIATION_LIMITS.perAlert) return;
    const added = createAlertVariation(
      event,
      settings,
      newVariationId(),
      `Variation ${existing.length + 1}`
    );
    patchVariant(event, { variations: [...existing, added] });
    setGroup("condition", true);
    go({ screen: "variation", event, id: added.id, snapshot: existing }, "in");
  }

  function duplicateVariation(event: AlertEventType, id: string) {
    const existing = cfg.variants[event].variations;
    const index = existing.findIndex((v) => v.id === id);
    if (index < 0 || existing.length >= ALERT_VARIATION_LIMITS.perAlert) return;
    const source = existing[index]!;
    const copy: AlertVariation = {
      ...source,
      id: newVariationId(),
      name: `${source.name} copy`.slice(0, ALERT_VARIATION_LIMITS.nameLength),
      settings: { ...source.settings },
    };
    patchVariant(event, {
      variations: [...existing.slice(0, index + 1), copy, ...existing.slice(index + 1)],
    });
  }

  function deleteVariation(event: AlertEventType, id: string) {
    const existing = cfg.variants[event].variations;
    const gone = existing.find((v) => v.id === id);
    if (!gone) return;
    patchVariant(event, { variations: existing.filter((v) => v.id !== id) });
    toast(`${gone.name} deleted.`, {
      id: "alert-variation-deleted",
      description: `${mod}+Z brings it back.`,
    });
  }

  function renderAlert(event: AlertEventType) {
    const variant = cfg.variants[event];
    return (
      <AlertDetail
        event={event}
        variant={variant}
        masterVolume={cfg.masterVolume}
        openGroups={openGroups}
        onOpenGroupChange={setGroup}
        testBusy={testBusy}
        variations={
          alertVariationParameters(event).length ? (
            <AlertVariationList
              itemId={item.id}
              event={event}
              variations={variant.variations}
              randomPick={variant.randomPick}
              open={openGroups.variations}
              onOpenChange={(open) => setGroup("variations", open)}
              returnTo={returnVariation}
              testBusy={testBusy}
              onEdit={(id) =>
                go({ screen: "variation", event, id, snapshot: variant.variations }, "in")
              }
              onToggle={(id, enabled) => patchVariation(event, id, { enabled })}
              onTest={(id) => void fireTest(event, id)}
              onDuplicate={(id) => duplicateVariation(event, id)}
              onDelete={(id) => deleteVariation(event, id)}
              onAddFromAlert={() => addVariation(event, variant)}
              onAddFromCopy={() => setCopyFor(event)}
              onRandomPickChange={(randomPick) => patchVariant(event, { randomPick })}
            />
          ) : undefined
        }
        onBack={() => {
          setReturnEvent(event);
          setReturnVariation(null);
          go({ screen: "list" }, "out");
        }}
        onPatch={(updates) => patchVariant(event, updates)}
        onTest={() => void fireTest(event)}
        onCopyLookToAll={() => copyLookToAll(event)}
      />
    );
  }

  function renderScreen() {
    if (view.screen === "list") {
      return (
        <AlertList
          itemId={item.id}
          cfg={cfg}
          category={category}
          onCategoryChange={setCategory}
          returnTo={returnEvent}
          testBusy={testBusy}
          fireMode={mode}
          onOpen={(event) => go({ screen: "alert", event }, "in")}
          onToggle={(event, enabled) => patchVariant(event, { enabled })}
          onTest={(event) => void fireTest(event)}
          onPatchConfig={patchConfig}
        />
      );
    }
    if (view.screen === "alert") return renderAlert(view.event);

    const { event, id, snapshot } = view;
    const variation = cfg.variants[event].variations.find((v) => v.id === id);
    // Gone from under the editor (an undo past its creation, say): its alert
    // is the nearest thing still there.
    if (!variation) return renderAlert(event);

    const before = snapshot.find((v) => v.id === id);
    return (
      <AlertVariationEditor
        event={event}
        variation={variation}
        isNew={!before}
        canCancel={!before || JSON.stringify(before) !== JSON.stringify(variation)}
        masterVolume={cfg.masterVolume}
        openGroups={openGroups}
        onOpenGroupChange={setGroup}
        testBusy={testBusy}
        onDone={() => {
          setReturnVariation(id);
          go({ screen: "alert", event }, "out");
        }}
        onCancel={() => {
          // The whole list goes back, so a new variation is gone and an edited
          // one is exactly what it was.
          patchVariant(event, { variations: snapshot });
          setReturnVariation(before ? id : null);
          go({ screen: "alert", event }, "out");
        }}
        onPatch={(updates) => patchVariation(event, id, updates)}
        onTest={() => void fireTest(event, id)}
      />
    );
  }

  const screenKey =
    view.screen === "list"
      ? "list"
      : view.screen === "alert"
        ? `alert-${view.event}`
        : `variation-${view.event}-${view.id}`;

  return (
    // The slide starts 16px to the side. Clipped here, at the panel's own edge
    // (the wrapper takes back the inspector's padding), or that offset becomes
    // sideways overflow and the panel flashes a scrollbar for the length of the
    // move. Clip, not hidden: hidden would make this the alert header's scroll
    // box and it would stop sticking to the panel.
    <div className="-mx-4 overflow-x-clip px-4">
      {/* Keyed, not wrapped in AnimatePresence: the screen leaving is dropped at
          once and only the one arriving moves, so two columns of fields never
          share the panel. */}
      <motion.div
        key={screenKey}
        initial={
          direction
            ? { opacity: 0, x: reduceMotion ? 0 : direction === "in" ? 16 : -16 }
            : false
        }
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        {renderScreen()}
      </motion.div>

      <AlertCopySourceDialog
        open={copyFor !== null}
        onOpenChange={(open) => !open && setCopyFor(null)}
        cfg={cfg}
        onPick={(settings) => copyFor && addVariation(copyFor, settings)}
      />
    </div>
  );
}
