"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Button,
  Input,
  Badge,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui";
import {
  createWidget,
  deleteWidget,
  getWidgets,
  getApprovedLibraryEntries,
  installWidgetFromLibrary,
} from "@/actions/widgets";
import type { Widget } from "@/actions/widgets";
import { buildWidgetSrcdoc, mergeFieldValues } from "@repo/ui/overlay";
import type { WidgetFieldSchema } from "@repo/ui/overlay";
import { Plus, Pencil, Trash2, Code2, Download } from "lucide-react";

const DEFAULT_WIDGET_HTML = `<!--
  StreamWizard Widget — HTML
  ─────────────────────────────────────────────────────────────
  Styling  → Tailwind CSS classes work everywhere (e.g. text-white, flex, rounded-xl)
  Animation → gsap and TextPlugin are available in the JS tab
  Fields   → add custom fields in the Fields tab, then reference them
             in the JS tab via fieldData.yourFieldName
  ─────────────────────────────────────────────────────────────
-->

<!-- Wrapper — targeted by gsap.from('#widget', ...) in the JS tab -->
<div id="widget" class="flex flex-col items-center justify-center w-full h-full gap-2 p-6 opacity-0">

  <!-- Event label, e.g. "New Follower!" -->
  <p id="label" class="text-white/60 text-sm font-medium uppercase tracking-widest">
    New Follower!
  </p>

  <!-- Username populated by JS: usernameEl.textContent = event.name -->
  <p id="username" class="text-white text-4xl font-bold drop-shadow-lg">
    StreamWizard
  </p>

  <!-- Supporting message, e.g. "just followed!" or "cheered 100 bits!" -->
  <p id="message" class="text-white/70 text-xl">
    just followed!
  </p>

</div>`;

const DEFAULT_WIDGET_JS = `/*
 * StreamWizard Widget — JavaScript
 *
 * Available globals:
 *   gsap        — GSAP animation library
 *   TextPlugin  — GSAP text animation
 *
 * Register TextPlugin if you want to animate text content:
 *   gsap.registerPlugin(TextPlugin);
 */

// ─── Widget load ────────────────────────────────────────────────────────────
// Fires once when the widget is mounted. Use this to set initial state
// and run your intro animation.
//
window.addEventListener('onWidgetLoad', function(obj) {
  const fieldData = obj.detail.fieldData;

  // Access your custom fields:
  // document.getElementById('username').style.color = fieldData.primaryColor;

  // Intro animation — fade + slide up (widget starts at opacity-0 in HTML)
  gsap.to('#widget', {
    opacity: 1,
    y: 0,
    duration: 0.5,
    ease: 'power2.out'
  });
});


// ─── Stream events ──────────────────────────────────────────────────────────
// Fires on every stream event. Use a timeline to sequence
// your animate-in, hold, and animate-out.
//
window.addEventListener('onEventReceived', function(obj) {
  const listener = obj.detail.listener;
  const event = obj.detail.event;

  if (listener === 'follower-latest') {
    showAlert(event.name, 'just followed!', 'New Follower!');
  }

  if (listener === 'subscriber-latest') {
    const months = event.amount > 1 ? \`for \${event.amount} months!\` : 'just subscribed!';
    showAlert(event.name, months, 'New Subscriber!');
  }

  if (listener === 'cheer-latest') {
    showAlert(event.name, \`cheered \${event.amount} bits!\`, 'Cheer!');
  }

  if (listener === 'tip-latest') {
    showAlert(event.name, \`tipped $\${event.amount}!\`, 'New Tip!');
  }

  if (listener === 'raid-latest') {
    showAlert(event.name, \`raided with \${event.amount} viewers!\`, 'Incoming Raid!');
  }
});


// ─── Helper: show alert with GSAP timeline ──────────────────────────────────
// Animate in → hold → animate out.
//
function showAlert(username, message, label = 'Alert') {
  const labelEl    = document.getElementById('label');
  const usernameEl = document.getElementById('username');
  const messageEl  = document.getElementById('message');
  if (labelEl)    labelEl.textContent    = label;
  if (usernameEl) usernameEl.textContent = username;
  if (messageEl)  messageEl.textContent  = message;

  const tl = gsap.timeline();

  // Animate in
  tl.fromTo('#widget',
    { opacity: 0, scale: 0.9, y: 10 },
    { opacity: 1, scale: 1,   y: 0,  duration: 0.4, ease: 'back.out(1.5)' }
  );

  // Hold
  tl.to('#widget', { duration: 3 });

  // Animate out
  tl.to('#widget',
    { opacity: 0, scale: 0.9, y: -10, duration: 0.3, ease: 'power2.in' }
  );
}


// ─── Session updates ────────────────────────────────────────────────────────
// Fires when session stats change (follower count, sub count, goals etc.)
// Useful for goal bars and stat displays.
//
window.addEventListener('onSessionUpdate', function(obj) {
  const session = obj.detail.session;

  // Example: update a follower count display
  // const count = session['follower-session']?.count ?? 0;
  // document.getElementById('follower-count').textContent = count;
});`;

interface LibraryEntry {
  id: string;
  title: string;
  description: string;
  tags: string[];
  installs: number;
  widgets: {
    html: string;
    js: string;
    extra_css: string;
    fields: WidgetFieldSchema;
  };
}

interface WidgetLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCanvas: (widgetId: string) => void;
}

export function WidgetLibraryModal({ open, onOpenChange, onAddToCanvas }: WidgetLibraryModalProps) {
  const router = useRouter();
  const [myWidgets, setMyWidgets] = useState<Widget[]>([]);
  const [libraryEntries, setLibraryEntries] = useState<LibraryEntry[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [search, setSearch] = useState("");
  const [newWidgetName, setNewWidgetName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingMine(true);
    getWidgets().then(({ data }) => {
      setMyWidgets(data ?? []);
      setLoadingMine(false);
    });
    setLoadingLibrary(true);
    getApprovedLibraryEntries().then(({ data }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setLibraryEntries((data ?? []) as any);
      setLoadingLibrary(false);
    });
  }, [open]);

  function handleCreate() {
    if (!newWidgetName.trim()) return;
    startTransition(async () => {
      const { data } = await createWidget({ name: newWidgetName.trim(), html: DEFAULT_WIDGET_HTML, js: DEFAULT_WIDGET_JS });
      if (data) {
        setCreateOpen(false);
        setNewWidgetName("");
        onOpenChange(false);
        router.push(`/dashboard/widgets/${data.id}`);
      }
    });
  }

  function confirmDelete(id: string) {
    setDeleteTargetId(id);
  }

  function handleDelete() {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    setDeleteTargetId(null);
    startTransition(async () => {
      await deleteWidget(id);
      setMyWidgets((prev) => prev.filter((w) => w.id !== id));
    });
  }

  function handleEdit(id: string) {
    onOpenChange(false);
    router.push(`/dashboard/widgets/${id}`);
  }

  function handleInstall(entryId: string) {
    setInstallingId(entryId);
    startTransition(async () => {
      const { data } = await installWidgetFromLibrary(entryId);
      setInstallingId(null);
      if (data) {
        setMyWidgets((prev) => [data, ...prev]);
      }
    });
  }

  const filteredLibrary = libraryEntries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen max-w-screen h-[85vh] flex flex-col rounded-none sm:rounded-lg sm:w-[98vw] sm:max-w-[98vw]">
        <DialogHeader>
          <DialogTitle>Widget Library</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="personal" className="flex flex-col flex-1 min-h-0">
          <TabsList className="shrink-0">
            <TabsTrigger value="personal">My Widgets</TabsTrigger>
            <TabsTrigger value="public">Public Library</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="flex-1 overflow-y-auto mt-4 space-y-4">
            <div className="flex justify-end">
              {createOpen ? (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Widget name"
                    value={newWidgetName}
                    onChange={(e) => setNewWidgetName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    autoFocus
                    className="h-8 w-48"
                  />
                  <Button size="sm" onClick={handleCreate} disabled={isPending || !newWidgetName.trim()}>
                    Create
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setCreateOpen(false); setNewWidgetName(""); }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New Widget
                </Button>
              )}
            </div>

            {loadingMine && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}
            {!loadingMine && myWidgets.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No widgets yet. Create your first one to get started.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {myWidgets.map((w) => (
                <div
                  key={w.id}
                  className="group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 hover:shadow-md transition-all duration-200"
                >
                  {/* Banner */}
                  <div className="relative h-28 bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-pink-500/10 flex items-center justify-center shrink-0">
                    <div className="rounded-xl bg-background/60 backdrop-blur-sm p-3 ring-1 ring-white/10">
                      <Code2 className="h-7 w-7 text-indigo-400" />
                    </div>
                    {/* Delete — appears on hover */}
                    <button
                      className="absolute top-2 right-2 h-7 w-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-background/70 backdrop-blur-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => confirmDelete(w.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex flex-col flex-1 px-4 pt-3 pb-4 gap-3">
                    <div>
                      <p className="font-semibold text-sm leading-snug truncate">{w.name}</p>
                      {w.description ? (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{w.description}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground/40 mt-0.5 italic">No description</p>
                      )}
                    </div>

                    <div className="flex gap-2 mt-auto">
                      <Button
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => {
                          onAddToCanvas(w.id);
                          onOpenChange(false);
                        }}
                      >
                        Add to canvas
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="px-2.5"
                        onClick={() => handleEdit(w.id)}
                        title="Edit code"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="public" className="flex-1 overflow-y-auto mt-4 space-y-4">
            <Input
              placeholder="Search widgets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />

            {loadingLibrary && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}
            {!loadingLibrary && filteredLibrary.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {search ? "No widgets match your search." : "No approved widgets in the library yet."}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredLibrary.map((entry) => (
                <LibraryCard
                  key={entry.id}
                  entry={entry}
                  onInstall={() => handleInstall(entry.id)}
                  isInstalling={installingId === entry.id}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete widget?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the widget and all its data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function LibraryCard({
  entry,
  onInstall,
  isInstalling,
}: {
  entry: LibraryEntry;
  onInstall: () => void;
  isInstalling: boolean;
}) {
  const srcdoc = buildWidgetSrcdoc(
    entry.widgets.html,
    entry.widgets.js,
    entry.widgets.extra_css,
    entry.widgets.fields,
    mergeFieldValues(entry.widgets.fields, {})
  );

  return (
    <div className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 hover:shadow-md transition-all duration-200">
      {/* Live preview */}
      <div className="relative h-40 bg-black shrink-0 overflow-hidden">
        <iframe
          srcDoc={srcdoc}
          sandbox="allow-scripts"
          className="absolute inset-0 w-full h-full border-0"
          style={{ pointerEvents: "none", background: "transparent", colorScheme: "normal" }}
          title={entry.title}
        />
        {/* installs badge */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[10px] text-white/70">
          <Download className="h-2.5 w-2.5" />
          {entry.installs}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 px-4 pt-3 pb-4 gap-3">
        <div>
          <p className="font-semibold text-sm leading-snug truncate">{entry.title}</p>
          {entry.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{entry.description}</p>
          )}
          {entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {entry.tags.map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Button size="sm" className="mt-auto w-full text-xs" onClick={onInstall} disabled={isInstalling}>
          {isInstalling ? "Installing…" : "Install"}
        </Button>
      </div>
    </div>
  );
}
