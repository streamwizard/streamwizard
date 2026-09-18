"use client";

import { useId, useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import {
  BUTTON_ACTIONS,
  BUTTON_STYLES,
  DISCORD_LIMITS,
  createButton,
  getButtonAction,
  type ButtonStyle,
  type ButtonsElement as Buttons,
  type MessageButton,
  type VariableDefinition,
} from "@repo/discord-message";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { NativeSelect, NativeSelectOption } from "../ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { normalizeUrl } from "./links";
import { RichTextView } from "./rich-text-view";

interface ButtonsElementProps {
  row: Buttons;
  variables: VariableDefinition[];
  disabled?: boolean;
  onChange: (patch: Partial<Omit<Buttons, "id" | "type">>) => void;
}

// Discord's button colours. Link buttons look like secondary ones with an arrow.
const STYLE_COLOR: Record<ButtonStyle, string> = { primary: "#5865f2", secondary: "#4e5058", success: "#248046", danger: "#da373c" };
const STYLE_NAME: Record<ButtonStyle, string> = { primary: "Blurple", secondary: "Grey", success: "Green", danger: "Red" };

const DEFAULT_ACTION = BUTTON_ACTIONS[0];

/** A row of Discord buttons. Click one to change what it says and does. */
export function ButtonsElement({ row, variables, disabled, onChange }: ButtonsElementProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const setButton = (next: MessageButton) => onChange({ buttons: row.buttons.map((button) => (button.id === next.id ? next : button)) });
  const full = row.buttons.length >= DISCORD_LIMITS.buttonsPerRow;

  const add = () => {
    const button = createButton({ kind: "link", label: "New button", url: "" });
    onChange({ buttons: [...row.buttons, button] });
    setOpenId(button.id);
  };

  return (
    <div className="flex max-w-[520px] flex-wrap items-center gap-2">
      {row.buttons.map((button) => (
        <Popover key={button.id} open={openId === button.id} onOpenChange={(open) => setOpenId(open ? button.id : null)}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label={`Edit button ${button.label || "without a label"}`}
              className="flex h-8 min-w-[60px] max-w-full items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium text-white outline-none transition-[filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed"
              style={{ backgroundColor: STYLE_COLOR[button.kind === "link" ? "secondary" : button.style] }}
            >
              <span className={cn("truncate", !button.label.trim() && "italic text-white/60")}>
                {button.label.trim() ? <RichTextView text={button.label} variables={variables} /> : "No label"}
              </span>
              {button.kind === "link" && <ExternalLink className="size-3.5 shrink-0" />}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-3">
            <ButtonForm
              button={button}
              onChange={setButton}
              onRemove={() => {
                setOpenId(null);
                onChange({ buttons: row.buttons.filter((b) => b.id !== button.id) });
              }}
            />
          </PopoverContent>
        </Popover>
      ))}
      <button
        type="button"
        onClick={add}
        disabled={disabled || full}
        title={full ? `Discord allows ${DISCORD_LIMITS.buttonsPerRow} buttons in a row. Add another row for more.` : "Add a button"}
        aria-label="Add a button"
        className="flex size-8 items-center justify-center rounded-lg border border-dashed border-white/25 text-[#949ba4] outline-none hover:border-white/50 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function ButtonForm({ button, onChange, onRemove }: { button: MessageButton; onChange: (next: MessageButton) => void; onRemove: () => void }) {
  const id = useId();
  const action = button.kind === "action" ? getButtonAction(button.action) : undefined;
  const badUrl = button.kind === "link" && button.url.trim() !== "" && normalizeUrl(button.url) === null;

  const setKind = (kind: MessageButton["kind"]) => {
    if (kind === button.kind) return;
    const base = { id: button.id, label: button.label };
    if (kind === "link") return onChange({ ...base, kind: "link", url: "" });
    // A button still called "New button" takes the action's wording.
    const label = button.label.trim() && button.label !== "New button" ? button.label : DEFAULT_ACTION.defaultLabel;
    onChange({ ...base, label, kind: "action", action: DEFAULT_ACTION.key, style: "primary" });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-label`} className="text-xs">
          Label
        </Label>
        <Input
          id={`${id}-label`}
          value={button.label}
          maxLength={DISCORD_LIMITS.buttonLabel}
          onChange={(e) => onChange({ ...button, label: e.target.value })}
          placeholder="Link your account"
          autoFocus
          className="h-8"
        />
      </div>

      <div role="radiogroup" aria-label="What the button does" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1 text-xs font-medium">
        {(
          [
            ["link", "Opens a link"],
            ["action", "Runs an action"],
          ] as const
        ).map(([kind, name]) => (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={button.kind === kind}
            onClick={() => setKind(kind)}
            className={cn(
              "rounded px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring",
              button.kind === kind ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {name}
          </button>
        ))}
      </div>

      {button.kind === "link" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-url`} className="text-xs">
            Link
          </Label>
          <Input
            id={`${id}-url`}
            value={button.url}
            onChange={(e) => onChange({ ...button, url: e.target.value })}
            // "twitch.tv/you" becomes "https://twitch.tv/you" once typing is done.
            onBlur={() => {
              const url = normalizeUrl(button.url);
              if (url && url !== button.url) onChange({ ...button, url });
            }}
            placeholder="https://twitch.tv/your-channel"
            inputMode="url"
            spellCheck={false}
            aria-invalid={badUrl || undefined}
            aria-describedby={badUrl ? `${id}-url-error` : undefined}
            className="h-8"
          />
          {badUrl && (
            <p id={`${id}-url-error`} className="text-xs text-destructive">
              Enter a web address, like https://twitch.tv/your-channel.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-action`} className="text-xs">
              Action
            </Label>
            <NativeSelect
              id={`${id}-action`}
              value={action ? button.action : ""}
              onChange={(e) => onChange({ ...button, action: e.target.value })}
              size="sm"
            >
              {!action && <NativeSelectOption value="">Pick an action</NativeSelectOption>}
              {BUTTON_ACTIONS.map((option) => (
                <NativeSelectOption key={option.key} value={option.key}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {action && <p className="text-xs text-muted-foreground">{action.description}</p>}
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium" id={`${id}-style`}>
              Colour
            </span>
            <div role="radiogroup" aria-labelledby={`${id}-style`} className="flex gap-1.5">
              {BUTTON_STYLES.map((style) => (
                <button
                  key={style}
                  type="button"
                  role="radio"
                  aria-checked={button.style === style}
                  aria-label={STYLE_NAME[style]}
                  title={STYLE_NAME[style]}
                  onClick={() => onChange({ ...button, style })}
                  className={cn(
                    "size-7 rounded-md outline-none ring-offset-2 ring-offset-popover focus-visible:ring-2 focus-visible:ring-ring",
                    button.style === style && "ring-2 ring-foreground",
                  )}
                  style={{ backgroundColor: STYLE_COLOR[style] }}
                />
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 />
          Remove button
        </Button>
      </div>
    </div>
  );
}
