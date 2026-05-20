"use client";

import { useState, useTransition, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import type { OnMount, Monaco } from "@monaco-editor/react";
import { useRouter } from "next/navigation";
import type { Widget } from "@/actions/widgets";
import { updateWidget, publishWidgetToLibrary, getActiveSubscriberToken } from "@/actions/widgets";
import { env } from "@repo/env/next";
import { WIDGET_EDITOR_DECLARATIONS } from "@repo/schemas";
import { buildWidgetSrcdoc, mergeFieldValues, CustomWidgetIframe } from "@repo/ui/overlay";
import type { WidgetFieldSchema, CustomWidgetIframeHandle } from "@repo/ui/overlay";
import { Button } from "@repo/ui";
import { Input } from "@repo/ui";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui";
import { Textarea } from "@repo/ui";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.default),
  { ssr: false }
);

const GSAP_TYPES = `
interface GSAPTweenVars {
  duration?: number;
  delay?: number;
  ease?: string;
  opacity?: number;
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  width?: number | string;
  height?: number | string;
  backgroundColor?: string;
  color?: string;
  fontSize?: number | string;
  repeat?: number;
  yoyo?: boolean;
  stagger?: number | object;
  onComplete?: () => void;
  onStart?: () => void;
  onUpdate?: () => void;
  [key: string]: any;
}

interface GSAPTimeline {
  to(targets: any, vars: GSAPTweenVars, position?: number | string): GSAPTimeline;
  from(targets: any, vars: GSAPTweenVars, position?: number | string): GSAPTimeline;
  fromTo(targets: any, fromVars: GSAPTweenVars, toVars: GSAPTweenVars, position?: number | string): GSAPTimeline;
  add(child: any, position?: number | string): GSAPTimeline;
  play(): GSAPTimeline;
  pause(): GSAPTimeline;
  reverse(): GSAPTimeline;
  restart(): GSAPTimeline;
  kill(): void;
  duration(): number;
  progress(value?: number): GSAPTimeline | number;
  repeat(value?: number): GSAPTimeline | number;
  delay(value?: number): GSAPTimeline | number;
}

interface GSAP {
  to(targets: any, vars: GSAPTweenVars): object;
  from(targets: any, vars: GSAPTweenVars): object;
  fromTo(targets: any, fromVars: GSAPTweenVars, toVars: GSAPTweenVars): object;
  set(targets: any, vars: GSAPTweenVars): object;
  timeline(vars?: GSAPTweenVars): GSAPTimeline;
  registerPlugin(...plugins: any[]): void;
  killTweensOf(targets: any): void;
  delayedCall(delay: number, callback: () => void): object;
  utils: {
    clamp(min: number, max: number, value: number): number;
    mapRange(inMin: number, inMax: number, outMin: number, outMax: number, value: number): number;
    interpolate(start: any, end: any, progress: number): any;
  };
}

declare const gsap: GSAP;

interface TextPlugin {
  text?: string | { value: string; delimiter?: string };
}
`;


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

type WsStatus = "disconnected" | "connecting" | "connected";

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
 *  can always call .map() safely. */
function coerceFields(fields: WidgetFieldSchema): WidgetFieldSchema {
  const out: WidgetFieldSchema = {};
  for (const [key, def] of Object.entries(fields)) {
    if (
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
  const [isSaving, startSave] = useTransition();
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishTitle, setPublishTitle] = useState(widget.name);
  const [publishDesc, setPublishDesc] = useState(widget.description ?? "");
  const [publishTags, setPublishTags] = useState(widget.tags?.join(", ") ?? "");
  const [isPublishing, startPublish] = useTransition();
  const widgetRef = useRef<CustomWidgetIframeHandle>(null);
  const hotReloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [srcdoc, setSrcdoc] = useState(() => {
    const fields = coerceFields(widget.fields as WidgetFieldSchema);
    const defaults = mergeFieldValues(fields, {});
    return buildWidgetSrcdoc(widget.html, widget.js, widget.extra_css, fields, defaults);
  });
  const [fieldData, setFieldData] = useState<Record<string, unknown>>(() => {
    const fields = coerceFields(widget.fields as WidgetFieldSchema);
    return mergeFieldValues(fields, {});
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [wsEnabled, setWsEnabled] = useState(false);
  const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const subscriberTokenRef = useRef<string | null>(null);

  // Fetch the subscriber token once on mount
  useEffect(() => {
    getActiveSubscriberToken().then(({ token }) => {
      subscriberTokenRef.current = token;
    });
  }, []);

  // Manage WS lifecycle based on the toggle
  useEffect(() => {
    if (!wsEnabled) {
      wsRef.current?.close();
      wsRef.current = null;
      setWsStatus("disconnected");
      return;
    }

    const token = subscriberTokenRef.current;
    if (!token) {
      setWsEnabled(false);
      return;
    }

    setWsStatus("connecting");
    const ws = new WebSocket(`${env.NEXT_PUBLIC_WS_SERVER_URL}/ws?role=subscriber&token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => setWsStatus("connected");

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { type: string; payload: unknown };
        widgetRef.current?.postMessage(
          { type: "onEventReceived", payload: { listener: msg.type, event: msg.payload } }
        );
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) setWsStatus("disconnected");
    };

    ws.onerror = () => ws.close();

    return () => {
      ws.close();
    };
  }, [wsEnabled]);

  function parsedFields(): WidgetFieldSchema | null {
    try {
      return coerceFields(JSON.parse(fieldsJsonRef.current) as WidgetFieldSchema);
    } catch {
      return null;
    }
  }

  function fireTestEvent(listener: string, event: Record<string, unknown>) {
    widgetRef.current?.postMessage({ type: "onEventReceived", payload: { listener, event } });
  }

  function refreshPreview() {
    const fields = parsedFields() ?? (widget.fields as WidgetFieldSchema);
    const defaults = mergeFieldValues(fields, {});
    setFieldData(defaults);
    setSrcdoc(buildWidgetSrcdoc(htmlRef.current, jsRef.current, cssRef.current, fields, defaults));
    setRefreshKey((k) => k + 1);
  }

  function handleSave() {
    const fields = parsedFields();
    if (!fields) return;
    startSave(async () => {
      await updateWidget(widget.id, { name, html: htmlRef.current, js: jsRef.current, extra_css: cssRef.current, fields });
      setIsDirty(false);
      refreshPreview();
    });
  }

  function handlePublish() {
    startPublish(async () => {
      const tags = publishTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const { error } = await publishWidgetToLibrary(widget.id, {
        title: publishTitle,
        description: publishDesc,
        tags,
      });
      if (!error) setPublishOpen(false);
    });
  }

  const handleMount: OnMount = useCallback((editor, monaco) => {
    monacoRef.current = monaco;

    // StreamWizard type definitions for the JS tab
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      WIDGET_EDITOR_DECLARATIONS,
      "streamwizard-api.d.ts"
    );
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      GSAP_TYPES,
      "gsap.d.ts"
    );

    // JSON schema validation for the fields tab
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
    });

    // Emmet completions for HTML and CSS
    registerEmmetProviders(monaco);

    // Ctrl/Cmd+S: format the current document
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      editor.getAction("editor.action.formatDocument")?.run();
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

    if (!validChange) return;
    if (hotReloadTimer.current) clearTimeout(hotReloadTimer.current);
    hotReloadTimer.current = setTimeout(refreshPreview, 600);
  }

  return (
    <div className="flex flex-col -mx-5 -my-5 md:-my-6 h-[calc(100vh-var(--header-height))]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-background shrink-0">
        <button
          onClick={() => router.back()}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back
        </button>
        <Input
          value={name}
          onChange={(e) => { setName(e.target.value); setIsDirty(true); }}
          className="h-8 text-sm w-48"
        />
        <div className="ml-auto flex items-center gap-2">
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
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Description</label>
                  <Textarea
                    value={publishDesc}
                    onChange={(e) => setPublishDesc(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">
                    Tags (comma separated)
                  </label>
                  <Input
                    value={publishTags}
                    onChange={(e) => setPublishTags(e.target.value)}
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
          <div className="shrink-0 px-3 py-1.5 border-b bg-background flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Preview</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs"
              onClick={refreshPreview}
            >
              Refresh
            </Button>
          </div>

          {/* Test event triggers */}
          <div className="shrink-0 px-3 py-1.5 border-b bg-background flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground mr-1 shrink-0">Test:</span>
            <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
              onClick={() => fireTestEvent("channel.follow", { user_id: "1", user_login: "testuser", user_name: "TestUser", broadcaster_user_id: "2", broadcaster_user_login: "broadcaster", broadcaster_user_name: "Broadcaster", followed_at: new Date().toISOString() })}>
              Follow
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
              onClick={() => fireTestEvent("channel.subscribe", { user_id: "1", user_login: "testuser", user_name: "TestUser", broadcaster_user_id: "2", broadcaster_user_login: "broadcaster", broadcaster_user_name: "Broadcaster", tier: "1000", is_gift: false })}>
              Sub
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
              onClick={() => fireTestEvent("channel.subscription.gift", { user_id: "1", user_login: "testuser", user_name: "TestUser", broadcaster_user_id: "2", broadcaster_user_login: "broadcaster", broadcaster_user_name: "Broadcaster", total: 5, tier: "1000", cumulative_total: 10, is_anonymous: false })}>
              Gift Sub
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
              onClick={() => fireTestEvent("channel.subscription.message", { user_id: "1", user_login: "testuser", user_name: "TestUser", broadcaster_user_id: "2", broadcaster_user_login: "broadcaster", broadcaster_user_name: "Broadcaster", tier: "1000", message: { text: "Love the stream!", emotes: [] }, cumulative_months: 6, streak_months: 3, duration_months: 1 })}>
              Resub
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
              onClick={() => fireTestEvent("channel.cheer", { is_anonymous: false, user_id: "1", user_login: "testuser", user_name: "TestUser", broadcaster_user_id: "2", broadcaster_user_login: "broadcaster", broadcaster_user_name: "Broadcaster", message: "PogChamp", bits: 100 })}>
              Cheer
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
              onClick={() => fireTestEvent("channel.raid", { from_broadcaster_user_id: "1", from_broadcaster_user_login: "testuser", from_broadcaster_user_name: "TestUser", to_broadcaster_user_id: "2", to_broadcaster_user_login: "broadcaster", to_broadcaster_user_name: "Broadcaster", viewers: 42 })}>
              Raid
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
              onClick={() => fireTestEvent("channel.chat.message", { broadcaster_user_id: "2", broadcaster_user_login: "broadcaster", broadcaster_user_name: "Broadcaster", chatter_user_id: "1", chatter_user_login: "testuser", chatter_user_name: "TestUser", message_id: crypto.randomUUID(), message: { text: "Hello streamer!", fragments: [{ type: "text", text: "Hello streamer!" }] }, color: "#FF6B6B", badges: [], message_type: "text", cheer: null, reply: null })}>
              Chat
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
              onClick={() => fireTestEvent("channel.channel_points_custom_reward_redemption.add", { id: crypto.randomUUID(), broadcaster_user_id: "2", broadcaster_user_login: "broadcaster", broadcaster_user_name: "Broadcaster", user_id: "1", user_login: "testuser", user_name: "TestUser", user_input: "Hello!", status: "unfulfilled", reward: { id: crypto.randomUUID(), title: "Test Reward", cost: 500, prompt: "" }, redeemed_at: new Date().toISOString() })}>
              Redeem
            </Button>
          </div>

          <CustomWidgetIframe
            key={refreshKey}
            ref={widgetRef}
            srcdoc={srcdoc}
            fieldData={fieldData}
            className="flex-1 w-full"
            title="Widget preview"
          />
        </div>
      </div>
    </div>
  );
}
