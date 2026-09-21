"use client";

import { useId, useMemo, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, Plus, RotateCcw } from "lucide-react";
import {
  DEFAULT_MAX_ELEMENTS,
  addElement,
  applyTheme,
  moveElement,
  removeElement,
  updateElement,
  validateMessage,
  type MessageElement,
} from "@repo/discord-message";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { BannerElement } from "./banner-element";
import { ButtonsElement } from "./buttons-element";
import { DISCORD } from "./discord-styles";
import { ElementShell } from "./element-shell";
import { EmbedElement } from "./embed-element";
import { DiscordMessageFrame } from "./message-frame";
import { PresetMenu } from "./preset-menu";
import { ThemePanel } from "./theme-panel";
import type { MessageBuilderProps } from "./types";

const elementName = (element: MessageElement): string => {
  if (element.type === "banner") return `${element.text || "Blank"} banner`;
  if (element.type === "buttons") return "button row";
  return `${element.title || "Untitled"} embed`;
};

/**
 * Visual editor for a Discord message made of banners and embeds. Feature
 * agnostic: it takes a message and reports every edit through onChange. What
 * it shows is what @repo/discord-message's planDiscordMessages has the bot send.
 */
export function MessageBuilder({
  value,
  onChange,
  presets,
  variables,
  themes,
  themePanel = true,
  bot,
  onReset,
  onUploadImage,
  onLockedClick,
  singleEmbed = false,
  emptyText,
  maxElements = DEFAULT_MAX_ELEMENTS,
  disabled = false,
}: MessageBuilderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  // Without a fixed id dnd-kit numbers its aria-describedby per render, which differs between server and client.
  const dndId = useId();
  const sensors = useSensors(
    // A few pixels of slack, so a click on the handle isn't a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const issues = useMemo(
    () => validateMessage(value, { maxElements, singleEmbed, allowedVariables: variables.map((v) => v.key) }),
    [value, maxElements, singleEmbed, variables],
  );
  const messageIssues = issues.filter(
    (issue) => issue.elementId === null && !(emptyText !== undefined && issue.code === "no_elements"),
  );

  const themeImage = (themes.find((t) => t.id === value.themeId) ?? themes[0])?.imageUrl;
  const hasBanners = value.elements.some((el) => el.type === "banner") || presets.some((p) => p.draft.type === "banner");
  const showThemes = themePanel && !singleEmbed && hasBanners && themes.length > 1;
  const full = value.elements.length >= maxElements;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onChange(moveElement(value, String(active.id), String(over.id)));
  };

  return (
    <div className={cn("grid gap-4", showThemes && "lg:grid-cols-[minmax(0,1fr)_17rem]")}>
      <div className="min-w-0 space-y-3">
        <div className="flex min-h-8 items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Hover an element to edit it. Click any text to change it.</p>
          {onReset && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" disabled={disabled}>
                  <RotateCcw />
                  Reset to default
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset to the default message?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your banners and embeds are replaced with the default template. What is already in Discord stays until you publish.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep my message</AlertDialogCancel>
                  <AlertDialogAction onClick={onReset}>Reset</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <DiscordMessageFrame bot={bot}>
          <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={onDragEnd}>
            <SortableContext items={value.elements.map((el) => el.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {value.elements.map((element) => (
                  <ElementShell
                    key={element.id}
                    id={element.id}
                    name={elementName(element)}
                    issues={issues.filter((issue) => issue.elementId === element.id)}
                    sortable={!singleEmbed}
                    disabled={disabled}
                    onDelete={() => onChange(removeElement(value, element.id))}
                  >
                    {element.type === "banner" ? (
                      <BannerElement
                        banner={element}
                        imageUrl={element.image?.url ?? themeImage}
                        disabled={disabled}
                        onUploadImage={onUploadImage}
                        onChange={(patch) => onChange(updateElement(value, element.id, patch))}
                      />
                    ) : element.type === "buttons" ? (
                      <ButtonsElement
                        row={element}
                        variables={variables}
                        disabled={disabled}
                        onChange={(patch) => onChange(updateElement(value, element.id, patch))}
                      />
                    ) : (
                      <EmbedElement
                        embed={element}
                        variables={variables}
                        disabled={disabled}
                        onChange={(patch) => onChange(updateElement(value, element.id, patch))}
                      />
                    )}
                  </ElementShell>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {value.elements.length === 0 && (
            <p className="py-6 text-sm" style={{ color: DISCORD.muted }}>
              {emptyText ?? "Nothing here yet. Add a banner, an embed or buttons below."}
            </p>
          )}
        </DiscordMessageFrame>

        {messageIssues.length > 0 && (
          <ul className="space-y-0.5 text-sm text-destructive" aria-live="polite">
            {messageIssues.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        )}

        {!singleEmbed && (
          <div className="space-y-3">
            <Button
              variant="outline"
              disabled={disabled || full}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Plus />
              Add element
              <ChevronDown className={cn("transition-transform", menuOpen && "rotate-180")} />
            </Button>
            {full && <p className="text-xs text-muted-foreground">That&apos;s the limit of {maxElements} elements. Delete one to add another.</p>}
            <div id={menuId} hidden={!menuOpen || full}>
              <PresetMenu presets={presets} onLockedClick={onLockedClick} onAdd={(preset) => onChange(addElement(value, preset.draft))} />
            </div>
          </div>
        )}

        {hasBanners && !singleEmbed && (
          <p className="text-xs text-muted-foreground">
            Banner text is a label for you and for screen readers. Discord shows the image as it is, so put any lettering in the image.
          </p>
        )}
      </div>

      {showThemes && (
        <ThemePanel
          themes={themes}
          selectedId={value.themeId}
          disabled={disabled}
          onLockedClick={onLockedClick}
          onSelect={(theme) => onChange(applyTheme(value, theme.id))}
        />
      )}
    </div>
  );
}
