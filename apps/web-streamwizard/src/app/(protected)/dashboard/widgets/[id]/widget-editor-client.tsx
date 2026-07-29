"use client";

import { useState, useTransition, useRef, useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import type { OnMount, Monaco } from "@monaco-editor/react";
import { useRouter } from "next/navigation";
import type { Widget } from "@/actions/widgets";
import { updateWidget, publishWidgetToLibrary } from "@/actions/widgets";
import { supabase } from "@repo/supabase/next/client";
import { useSession } from "@/providers/session-provider";
import { env } from "@/lib/env";
import { WIDGET_EDITOR_DECLARATIONS, WIDGET_EDITOR_LIB_DECLARATIONS, DEMO_EVENT_TYPES } from "@repo/schemas";
import { buildWidgetSrcdoc, mergeFieldValues, flattenFieldSchema, GROUP_FIELD_TYPE, resolveWidgetTemplate, CustomWidgetIframe, scanWidgetListeners } from "@repo/ui/overlay";
import { AssetPickerDialog } from "@/components/media/asset-picker-dialog";
import { DemoEventPanel } from "@/components/demo/demo-event-panel";
import { WidgetFieldsPanel } from "./widget-fields-panel";
import { WidgetConsolePanel } from "./widget-console-panel";
import {
  WIDGET_FIELDS_JSON_SCHEMA,
  WIDGET_FIELDS_SCHEMA_URI,
} from "./widget-fields-json-schema";
import { ImagePlus, Info } from "lucide-react";
import type { WidgetFieldSchema, CustomWidgetIframeHandle, WsRoomOptions, WsRoomStatus, WidgetLogEntry } from "@repo/ui/overlay";
import { Button } from "@repo/ui";
import { Input } from "@repo/ui";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui";
import { Textarea } from "@repo/ui";

// Self-hosted Monaco + Tailwind language service. Importing the wrapper rather
// than @monaco-editor/react directly guarantees setupMonaco() runs before the
// editor asks the loader for an instance. See src/lib/monaco/setup.ts.
const MonacoEditor = dynamic(() => import("@/lib/monaco/editor"), {
  ssr: false,
});



const EDITOR_OPTIONS = {
  fontSize: 14,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: "on" as const,
  tabSize: 2,
  padding: { top: 16 },
  autoClosingBrackets: "beforeWhitespace" as const,
  autoClosingQuotes: "beforeWhitespace" as const,
  autoIndent: "brackets" as const,
  formatOnPaste: false,
  formatOnType: false,
};

/** Console/error mirroring is editor-only — overlays don't need the traffic. */
const SRCDOC_OPTS = { forwardLogs: true } as const;

/** Ring-buffer bound so a runaway logging loop can't grow the page unbounded. */
const MAX_LOGS = 300;

// Module-scoped: Monaco's providers are global to the loaded instance, and this
// page never mounts two editors. Would need to become per-instance if it did.
let emmetProvidersRegistered = false;

function registerEmmetProviders(monaco: Monaco) {
  if (emmetProvidersRegistered) return;
  emmetProvidersRegistered = true;

  // Lazily imported so the expand-abbreviation bundle never runs on the server
  import("@emmetio/expand-abbreviation").then(({ expand }) => {
    function makeProvider(syntax: "html" | "css") {
      return {
        triggerCharacters: syntax === "css" ? [" ", ":"] : [">", " "],
        provideCompletionItems(
          model: Parameters<
            Parameters<typeof monaco.languages.registerCompletionItemProvider>[1]["provideCompletionItems"]
          >[0],
          position: Parameters<
            Parameters<typeof monaco.languages.registerCompletionItemProvider>[1]["provideCompletionItems"]
          >[1]
        ) {
          const col = position.column - 1;
          const before = model.getLineContent(position.lineNumber).slice(0, col);
          const match = before.match(/[\w>+.*#[\](){}^$=@!|"'-]+$/);
          if (!match) return { suggestions: [] };
          const abbrev = match[0];

          let expanded: string;
          try {
            expanded = expand(abbrev, { syntax });
          } catch {
            return { suggestions: [] };
          }
          if (!expanded || expanded === abbrev) return { suggestions: [] };

          const startCol = col - abbrev.length + 1;
          return {
            suggestions: [
              {
                label: abbrev,
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: expanded,
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range: new monaco.Range(
                  position.lineNumber,
                  startCol,
                  position.lineNumber,
                  position.column
                ),
                detail: "Emmet",
                documentation: expanded,
              },
            ],
          };
        },
      };
    }

    monaco.languages.registerCompletionItemProvider("html", makeProvider("html"));
    monaco.languages.registerCompletionItemProvider("css", makeProvider("css"));
  });
}

/** Normalize fields authored in the JSON editor before saving or previewing.
 *  Dropdown options may be written as a plain object { value: label } instead
 *  of the canonical array [{ value, label }]. Coerce them so downstream code
 *  can always call .map() safely. Groups are walked so fields nested in a
 *  collapsible section get the same treatment. */
function coerceFields(fields: WidgetFieldSchema): WidgetFieldSchema {
  const out: WidgetFieldSchema = {};
  for (const [key, def] of Object.entries(fields)) {
    if (def.type === GROUP_FIELD_TYPE) {
      out[key] = { ...def, fields: coerceFields(def.fields ?? {}) };
    } else if (
      def.type === "dropdown" &&
      def.options !== undefined &&
      !Array.isArray(def.options)
    ) {
      out[key] = {
        ...def,
        options: Object.entries(def.options as Record<string, string>).map(
          ([value, label]) => ({ value, label })
        ),
      };
    } else {
      out[key] = def;
    }
  }
  return out;
}

export function WidgetEditorClient({ widget }: { widget: Widget }) {
  const router = useRouter();
  const [name, setName] = useState(widget.name);
  const htmlRef = useRef(widget.html);
  const jsRef = useRef(widget.js);
  const cssRef = useRef(widget.extra_css);
  const fieldsJsonRef = useRef(JSON.stringify(widget.fields, null, 2));
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"html" | "js" | "fields" | "css">("html");
  const [isDirty, setIsDirty] = useState(false);
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [isSaving, startSave] = useTransition();
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishTitle, setPublishTitle] = useState(widget.name);
  const [isPublishing, startPublish] = useTransition();
  // Widget metadata, saved with the code instead of only reaching the library
  // submission -- the widget row's own description and tags used to rot.
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [description, setDescription] = useState(widget.description ?? "");
  const [tagsText, setTagsText] = useState(widget.tags?.join(", ") ?? "");
  const [logs, setLogs] = useState<WidgetLogEntry[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const widgetRef = useRef<CustomWidgetIframeHandle>(null);
  const hotReloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [srcdoc, setSrcdoc] = useState(() => {
    const fields = coerceFields(widget.fields as WidgetFieldSchema);
    const defaults = mergeFieldValues(fields, {});
    return buildWidgetSrcdoc(widget.html, widget.js, widget.extra_css, fields, defaults, undefined, env.NEXT_PUBLIC_ASSET_CDN_URL, SRCDOC_OPTS);
  });
  const [fieldData, setFieldData] = useState<Record<string, unknown>>(() => {
    const fields = coerceFields(widget.fields as WidgetFieldSchema);
    return mergeFieldValues(fields, {});
  });
  // Schema mirror of the Fields tab, so the field panel can render without
  // reparsing the JSON on every keystroke.
  const [fieldsSchema, setFieldsSchema] = useState<WidgetFieldSchema>(() =>
    coerceFields(widget.fields as WidgetFieldSchema)
  );
  // Editor-session-only values the author is trying out, keyed by field.
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, unknown>>({});
  // Mirrored so the debounced hot-reload timer doesn't act on a stale closure.
  const fieldOverridesRef = useRef(fieldOverrides);
  useEffect(() => {
    fieldOverridesRef.current = fieldOverrides;
  }, [fieldOverrides]);
  // Mirror of jsRef for the demo panel's listener scan, refreshed with the
  // preview rather than on every keystroke.
  const [jsSource, setJsSource] = useState(widget.js);
  const [legacyDemoDismissed, setLegacyDemoDismissed] = useState(false);
  const [fieldsPanelOpen, setFieldsPanelOpen] = useState(true);
  // Manual mode stops the iframe remounting mid-edit, which is the difference
  // between debugging an animation and watching it restart every keystroke.
  const [reloadMode, setReloadMode] = useState<"live" | "manual">("live");
  const [refreshKey, setRefreshKey] = useState(0);
  const [wsEnabled, setWsEnabled] = useState(false);
  const [wsStatus, setWsStatus] = useState<WsRoomStatus>("disconnected");
  const user = useSession();

  // Subscribing to the signed-in user's own room needs no scene: ws-server's
  // subscriber path accepts a Supabase JWT directly, same as the IRL dashboard
  // widgets. Resolved per connect so a refreshed token reuses the same room.
  const wsRoom = useMemo<WsRoomOptions | undefined>(() => {
    if (!wsEnabled) return undefined;
    return {
      roomKey: `dashboard:${user.id}`,
      wsUrl: env.NEXT_PUBLIC_WS_SERVER_URL,
      getToken: async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? "";
      },
    };
  }, [wsEnabled, user.id]);

  // Flags the pattern Demo mode replaces, so authors know the field and the
  // fake-data loop in their own script are now dead weight.
  const legacyDemo = useMemo(() => {
    if (legacyDemoDismissed) return null;
    return scanWidgetListeners(jsSource, DEMO_EVENT_TYPES).legacyDemo;
  }, [jsSource, legacyDemoDismissed]);

  function parsedFields(): WidgetFieldSchema | null {
    try {
      return coerceFields(JSON.parse(fieldsJsonRef.current) as WidgetFieldSchema);
    } catch {
      return null;
    }
  }

  function insertAssetUrl(url: string) {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;
    // executeEdits fires onChange, which marks dirty and hot-reloads the preview
    editor.executeEdits("asset-picker", [{ range: selection, text: url, forceMoveMarkers: true }]);
    editor.focus();
  }

  function fireTestEvent(listener: string, event: Record<string, unknown>) {
    widgetRef.current?.postMessage({ type: "onEventReceived", payload: { listener, event } });
  }

  function refreshPreview(overrideValues?: Record<string, unknown>) {
    const fields = parsedFields() ?? (widget.fields as WidgetFieldSchema);
    // Renaming or deleting a field in the JSON must drop its stale override.
    const source = overrideValues ?? fieldOverridesRef.current;
    const overrides: Record<string, unknown> = {};
    for (const key of Object.keys(flattenFieldSchema(fields))) {
      if (key in source) overrides[key] = source[key];
    }

    setFieldsSchema(fields);
    setFieldOverrides(overrides);
    fieldOverridesRef.current = overrides;
    setFieldData(mergeFieldValues(fields, overrides));
    setSrcdoc(buildWidgetSrcdoc(htmlRef.current, jsRef.current, cssRef.current, fields, overrides, undefined, env.NEXT_PUBLIC_ASSET_CDN_URL, SRCDOC_OPTS));
    // Mirrored into state so the demo panel's listener scan follows the source
    // the author is actually editing; jsRef alone never triggers a re-render.
    setJsSource(jsRef.current);
    setRefreshKey((k) => k + 1);
  }

  function setFieldOverride(key: string, value: unknown) {
    // Field values feed both {{placeholder}} substitution in the HTML/CSS and
    // the fieldData handed to JS, so the document has to be rebuilt.
    refreshPreview({ ...fieldOverridesRef.current, [key]: value });
  }

  function parsedTags(): string[] {
    return tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  const handleSave = useCallback(() => {
    const fields = parsedFields();
    if (!fields) {
      toast.error("Fix the Fields JSON before saving");
      return;
    }
    startSave(async () => {
      const { error } = await updateWidget(widget.id, {
        name,
        description,
        tags: parsedTags(),
        html: htmlRef.current,
        js: jsRef.current,
        extra_css: cssRef.current,
        fields,
      });
      if (error) {
        toast.error(error);
        return;
      }
      setIsDirty(false);
      refreshPreview();
      toast.success("Widget saved");
    });
    // handleSave is bound into a Monaco command once at mount; the refs it reads
    // are stable, and the state it reads is re-read via the latest closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, description, tagsText, widget.id]);

  // Keep the Monaco keybinding pointed at the current closure without
  // re-registering the command on every keystroke.
  const handleSaveRef = useRef(handleSave);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  function handlePublish() {
    startPublish(async () => {
      const { error } = await publishWidgetToLibrary(widget.id, {
        title: publishTitle,
        description,
        tags: parsedTags(),
      });
      if (error) {
        toast.error(error);
        return;
      }
      setPublishOpen(false);
      toast.success("Submitted for review");
    });
  }

  // Browser-level guard. Next's client router can't be intercepted here, so the
  // in-app escape hatch (the Back button) confirms separately.
  useEffect(() => {
    if (!isDirty) return;
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  function handleBack() {
    if (isDirty && !window.confirm("You have unsaved changes. Leave anyway?")) return;
    router.back();
  }

  function appendLog(entry: WidgetLogEntry) {
    setLogs((prev) => {
      const next = [...prev, entry];
      return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next;
    });
    if (entry.level === "error") setConsoleOpen(true);
  }

  const handleMount: OnMount = useCallback((editor, monaco) => {
    monacoRef.current = monaco;
    editorRef.current = editor;

    // StreamWizard type definitions for the JS tab
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      WIDGET_EDITOR_DECLARATIONS,
      "streamwizard-api.d.ts"
    );
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      WIDGET_EDITOR_LIB_DECLARATIONS,
      "streamwizard-libs.d.ts"
    );

    // JSON schema validation + completion for the fields tab. `path="fields"`
    // on the editor produces the model uri this matches on.
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [
        {
          uri: WIDGET_FIELDS_SCHEMA_URI,
          fileMatch: ["fields"],
          schema: WIDGET_FIELDS_JSON_SCHEMA,
        },
      ],
    });

    // Emmet completions for HTML and CSS
    registerEmmetProviders(monaco);

    // Ctrl/Cmd+S saves. Formatting keeps Monaco's own Shift+Alt+F.
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSaveRef.current();
    });
  }, []);

  const editorLanguage: Record<typeof activeTab, string> = {
    html: "html",
    js: "javascript",
    fields: "json",
    css: "css",
  };

  const editorDefaultValue =
    activeTab === "html" ? htmlRef.current
    : activeTab === "js" ? jsRef.current
    : activeTab === "fields" ? fieldsJsonRef.current
    : cssRef.current;

  /** Swaps author CSS in the running document — no remount, no lost state. */
  function patchPreviewCss() {
    const fields = parsedFields() ?? fieldsSchema;
    const { resolvedCss } = resolveWidgetTemplate(
      "",
      cssRef.current,
      fields,
      fieldOverridesRef.current
    );
    widgetRef.current?.postMessage({ type: "swPatchCss", css: resolvedCss });
  }

  function handleEditorChange(v: string | undefined) {
    const val = v ?? "";
    if (!isDirty) setIsDirty(true);

    let validChange = true;
    if (activeTab === "html") htmlRef.current = val;
    else if (activeTab === "js") jsRef.current = val;
    else if (activeTab === "css") cssRef.current = val;
    else {
      fieldsJsonRef.current = val;
      try { JSON.parse(val); setFieldsError(null); } catch { setFieldsError("Invalid JSON"); validChange = false; }
    }

    if (!validChange || reloadMode === "manual") return;
    if (hotReloadTimer.current) clearTimeout(hotReloadTimer.current);
    // JS gets a longer debounce: reloading it costs the widget all its state,
    // so mid-expression rebuilds are pure noise.
    const isCss = activeTab === "css";
    hotReloadTimer.current = setTimeout(
      isCss ? patchPreviewCss : refreshPreview,
      isCss ? 250 : activeTab === "js" ? 1000 : 600
    );
  }

  return (
    <div className="flex flex-col -mx-5 -my-5 md:-my-6 h-[calc(100vh-var(--header-height))]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-background shrink-0">
        <button
          onClick={handleBack}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back
        </button>
        <Input
          value={name}
          onChange={(e) => { setName(e.target.value); setIsDirty(true); }}
          className="h-8 text-sm w-48"
        />
        <Popover open={detailsOpen} onOpenChange={setDetailsOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 text-xs">
              Details
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); setIsDirty(true); }}
                rows={3}
                placeholder="What does this widget do?"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Tags (comma separated)</label>
              <Input
                value={tagsText}
                onChange={(e) => { setTagsText(e.target.value); setIsDirty(true); }}
                placeholder="irl, speed, overlay"
              />
            </div>
            <p className="text-xs text-muted-foreground">Saved with the widget.</p>
          </PopoverContent>
        </Popover>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={`${env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.streamwizard.org"}/overlays/widgets`}
            target="_blank"
            rel="noreferrer"
            className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-accent transition-colors text-muted-foreground"
            title="Widget API reference"
          >
            Docs
          </a>
          <button
            type="button"
            onClick={() => setWsEnabled((v) => !v)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border hover:bg-accent transition-colors"
            title={wsEnabled ? "Disconnect from live events" : "Connect to live Twitch events"}
          >
            <span
              className={
                wsStatus === "connected"
                  ? "h-2 w-2 rounded-full bg-green-500"
                  : wsStatus === "connecting"
                  ? "h-2 w-2 rounded-full bg-yellow-400 animate-pulse"
                  : "h-2 w-2 rounded-full bg-zinc-500"
              }
            />
            {wsStatus === "connected" ? "Live" : wsStatus === "connecting" ? "Connecting…" : "Connect"}
          </button>
          <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                Publish to Library
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Publish Widget</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Title</label>
                  <Input
                    value={publishTitle}
                    onChange={(e) => setPublishTitle(e.target.value)}
                  />
                </div>
                {/* Description and tags come from the widget's own details, so
                    the library entry and the widget row can't disagree. */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Description</label>
                  <Textarea
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); setIsDirty(true); }}
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">
                    Tags (comma separated)
                  </label>
                  <Input
                    value={tagsText}
                    onChange={(e) => { setTagsText(e.target.value); setIsDirty(true); }}
                    placeholder="irl, speed, overlay"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Your widget will be reviewed before appearing in the library.
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPublishOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handlePublish} disabled={isPublishing}>
                    Submit for Review
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !isDirty || !!fieldsError}
          >
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* Editor + Preview split */}
      <div className="flex flex-1 min-h-0">
        {/* Left: code tabs */}
        <div className="flex flex-col w-1/2 border-r min-h-0">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as typeof activeTab)}
            className="flex flex-col flex-1 min-h-0"
          >
            <TabsList className="shrink-0 rounded-none border-b h-9 justify-start px-2 gap-1">
              <TabsTrigger value="html" className="text-xs h-7">HTML</TabsTrigger>
              <TabsTrigger value="js" className="text-xs h-7">JS</TabsTrigger>
              <TabsTrigger value="fields" className="text-xs h-7">
                Fields {fieldsError && <span className="ml-1 text-destructive">!</span>}
              </TabsTrigger>
              <TabsTrigger value="css" className="text-xs h-7">Extra CSS</TabsTrigger>
              <button
                type="button"
                onClick={() => setAssetPickerOpen(true)}
                className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors"
                title="Insert a media-library file URL at the cursor"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Insert asset
              </button>
            </TabsList>

            <div className="flex-1 min-h-0">
              <MonacoEditor
                height="100%"
                theme="vs-dark"
                language={editorLanguage[activeTab]}
                defaultValue={editorDefaultValue}
                onChange={handleEditorChange}
                onMount={handleMount}
                options={EDITOR_OPTIONS}
                path={activeTab}
              />
            </div>
          </Tabs>
        </div>

        {/* Right: sandboxed preview */}
        <div
          className="flex flex-col w-1/2 min-h-0"
          style={{
            backgroundColor: "#1a1a1a",
            backgroundImage:
              "linear-gradient(45deg,#2a2a2a 25%,transparent 25%),linear-gradient(-45deg,#2a2a2a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2a2a 75%),linear-gradient(-45deg,transparent 75%,#2a2a2a 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
          }}
        >
          <div className="shrink-0 px-3 py-1.5 border-b bg-background flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Preview</span>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center rounded-md border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setReloadMode("live")}
                  title="Rebuild the preview as you type"
                  className={`text-[11px] px-2 py-0.5 transition-colors ${
                    reloadMode === "live" ? "bg-accent text-foreground" : "text-muted-foreground"
                  }`}
                >
                  Live
                </button>
                <button
                  type="button"
                  onClick={() => setReloadMode("manual")}
                  title="Only rebuild on Refresh or Save — keeps animations and timers running"
                  className={`text-[11px] px-2 py-0.5 transition-colors ${
                    reloadMode === "manual" ? "bg-accent text-foreground" : "text-muted-foreground"
                  }`}
                >
                  Manual
                </button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
                onClick={() => setFieldsPanelOpen((v) => !v)}
              >
                {fieldsPanelOpen ? "Hide fields" : "Fields"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
                onClick={() => refreshPreview()}
              >
                Refresh
              </Button>
            </div>
          </div>

          <DemoEventPanel
            storageId={widget.id}
            sourceJs={jsSource}
            wsConnected={wsStatus === "connected"}
            onFireLocal={fireTestEvent}
          />

          {legacyDemo && (
            <div className="shrink-0 border-b bg-amber-500/5 px-3 py-1.5">
              <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                <Info className="mt-0.5 h-3 w-3 shrink-0 opacity-80" aria-hidden />
                <span>
                  This widget ships its own demo mode (
                  {legacyDemo.hits.map((hit, i) => (
                    <span key={hit}>
                      {i > 0 && ", "}
                      <code className="text-foreground/80">{hit}</code>
                    </span>
                  ))}
                  ). Demo mode above replaces it — you can drop that code and its field.
                </span>
                <button
                  type="button"
                  onClick={() => setLegacyDemoDismissed(true)}
                  className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
                >
                  Dismiss
                </button>
              </p>
            </div>
          )}

          <div className="flex flex-1 min-h-0">
            <CustomWidgetIframe
              key={refreshKey}
              ref={widgetRef}
              srcdoc={srcdoc}
              fieldData={fieldData}
              wsRoom={wsRoom}
              onWsStatus={setWsStatus}
              onLog={appendLog}
              className="flex-1 min-w-0"
              title="Widget preview"
            />
            {fieldsPanelOpen && (
              <WidgetFieldsPanel
                fields={fieldsSchema}
                overrides={fieldOverrides}
                onChange={setFieldOverride}
                onReset={() => refreshPreview({})}
              />
            )}
          </div>

          <WidgetConsolePanel
            logs={logs}
            open={consoleOpen}
            onToggle={() => setConsoleOpen((v) => !v)}
            onClear={() => setLogs([])}
          />
        </div>
      </div>

      <AssetPickerDialog
        open={assetPickerOpen}
        onOpenChange={setAssetPickerOpen}
        onSelect={(asset) => insertAssetUrl(asset.url)}
        title="Insert asset"
      />
    </div>
  );
}
