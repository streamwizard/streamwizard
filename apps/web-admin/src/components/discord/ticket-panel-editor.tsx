"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BUTTON_STYLES,
  MESSAGE_PRESETS,
  TICKET_BUTTON_LABEL_MAX,
  TICKET_MENU_PLACEHOLDER_MAX,
  TICKET_PANEL_LAYOUTS,
  TICKET_PANEL_VARIABLES,
  defaultTicketPanel,
  validateMessage,
  type TicketPanel,
  type TicketPanelLayout,
} from "@repo/discord-message";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, NativeSelect, NativeSelectOption } from "@repo/ui";
import { MessageBuilder, type BuilderTheme } from "@repo/ui/message-builder";
import { saveTicketPanelAction } from "@/actions/discord-ticket-design";
import { uploadBanner } from "@/lib/discord/banner-upload-client";
import { SaveBar, SettingRow } from "./setting-row";
import { toastResult } from "./toast-result";

const VALIDATE = { allowedVariables: TICKET_PANEL_VARIABLES.map((variable) => variable.key) };

const LAYOUTS: Record<TicketPanelLayout, { name: string; hint: string }> = {
  button: { name: "One button", hint: "Members press it, then the bot asks which category." },
  buttons: { name: "A button per category", hint: "One press takes them straight to that category's form." },
  menu: { name: "A dropdown of categories", hint: "Shows each category's description. Best with many categories." },
};

const STYLE_NAMES: Record<(typeof BUTTON_STYLES)[number], string> = {
  primary: "Blurple",
  secondary: "Grey",
  success: "Green",
  danger: "Red",
};

interface TicketPanelEditorProps {
  initial: TicketPanel;
  /** Where the panel is posted, e.g. "#support". Null when no panel channel is picked yet. */
  postedIn: string | null;
  themes: BuilderTheme[];
  bot: { name: string; avatarUrl?: string | null };
  uploadsEnabled: boolean;
}

/** The message members open tickets from, and how its Create Ticket controls look. */
export function TicketPanelEditor({ initial, postedIn, themes, bot, uploadsEnabled }: TicketPanelEditorProps) {
  const router = useRouter();
  const [panel, setPanel] = useState(initial);
  const [saving, startSave] = useTransition();
  const set = <K extends keyof TicketPanel>(key: K, value: TicketPanel[K]) =>
    setPanel((current) => ({ ...current, [key]: value }));

  const dirty = JSON.stringify(panel) !== JSON.stringify(initial);
  const blocked =
    validateMessage(panel.message, VALIDATE)[0]?.message ??
    (!panel.buttonLabel.trim() ? "The button needs a label." : null) ??
    (!panel.menuPlaceholder.trim() ? "The dropdown needs a placeholder." : null);

  const save = () =>
    startSave(async () => {
      const result = await saveTicketPanelAction(panel);
      if (toastResult(result, postedIn ? `Panel saved and updated in ${postedIn}.` : "Panel saved.")) router.refresh();
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Panel message</CardTitle>
          <CardDescription>
            {postedIn
              ? `Posted in ${postedIn}. Saving updates it there.`
              : "Not posted yet. Pick a panel channel under General and it goes up."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MessageBuilder
            value={panel.message}
            onChange={(message) => set("message", message)}
            presets={MESSAGE_PRESETS}
            variables={TICKET_PANEL_VARIABLES}
            themes={themes}
            bot={bot}
            onReset={() => set("message", defaultTicketPanel().message)}
            onUploadImage={uploadsEnabled ? uploadBanner : undefined}
            disabled={saving}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create Ticket controls</CardTitle>
          <CardDescription>The bot adds these under the message. They can&apos;t be removed, only shaped.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <SettingRow htmlFor="panel-layout" label="Layout" hint={LAYOUTS[panel.layout].hint}>
            <NativeSelect
              id="panel-layout"
              value={panel.layout}
              onChange={(event) => set("layout", event.target.value as TicketPanelLayout)}
              disabled={saving}
            >
              {TICKET_PANEL_LAYOUTS.map((layout) => (
                <NativeSelectOption key={layout} value={layout}>
                  {LAYOUTS[layout].name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </SettingRow>

          {panel.layout === "button" && (
            <>
              <SettingRow htmlFor="panel-button-label" label="Button label">
                <Input
                  id="panel-button-label"
                  value={panel.buttonLabel}
                  onChange={(event) => set("buttonLabel", event.target.value)}
                  maxLength={TICKET_BUTTON_LABEL_MAX}
                  disabled={saving}
                />
              </SettingRow>
              <SettingRow
                htmlFor="panel-button-emoji"
                label="Button emoji"
                hint={"One emoji, or a server emoji as <:name:id>. Optional."}
              >
                <Input
                  id="panel-button-emoji"
                  value={panel.buttonEmoji ?? ""}
                  onChange={(event) => set("buttonEmoji", event.target.value || null)}
                  maxLength={64}
                  className="w-40"
                  disabled={saving}
                />
              </SettingRow>
            </>
          )}

          {panel.layout !== "menu" && (
            <SettingRow
              htmlFor="panel-button-style"
              label="Button colour"
              hint={panel.layout === "buttons" ? "Every category button gets it. Labels and emoji come from the categories." : undefined}
            >
              <NativeSelect
                id="panel-button-style"
                value={panel.buttonStyle}
                onChange={(event) => set("buttonStyle", event.target.value as TicketPanel["buttonStyle"])}
                disabled={saving}
              >
                {BUTTON_STYLES.map((style) => (
                  <NativeSelectOption key={style} value={style}>
                    {STYLE_NAMES[style]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </SettingRow>
          )}

          {panel.layout === "menu" && (
            <SettingRow htmlFor="panel-menu-placeholder" label="Dropdown placeholder" hint="Shown before a member picks anything.">
              <Input
                id="panel-menu-placeholder"
                value={panel.menuPlaceholder}
                onChange={(event) => set("menuPlaceholder", event.target.value)}
                maxLength={TICKET_MENU_PLACEHOLDER_MAX}
                disabled={saving}
              />
            </SettingRow>
          )}

          {dirty && blocked && <p className="pt-3 text-sm text-destructive">{blocked}</p>}
          <SaveBar dirty={dirty && !blocked} pending={saving} onSave={save} onReset={() => setPanel(initial)} />
        </CardContent>
      </Card>
    </div>
  );
}
