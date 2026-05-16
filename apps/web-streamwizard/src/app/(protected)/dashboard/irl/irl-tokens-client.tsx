"use client";

import { useState } from "react";
import { createIrlToken, deleteIrlToken } from "@/actions/irl-tokens";
import type { IrlCollectorToken } from "@/actions/irl-tokens";
import {
  Button,
  Input,
  Badge,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui";
import { Smartphone, Copy, Check, Trash2, Plus, Mail, QrCode, Share2 } from "lucide-react";

export function IrlTokensClient({
  tokens,
  error,
}: {
  tokens: IrlCollectorToken[];
  error: string | null;
}) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newUrl, setNewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [list, setList] = useState<IrlCollectorToken[]>(tokens);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    setNewUrl(null);
    setCreateError(null);
    const result = await createIrlToken(name.trim());
    setCreating(false);
    if (result.error) {
      setCreateError(result.error);
    } else if (result.data) {
      setNewUrl(result.data.token_url);
      setName("");
      setList((prev) => [
        {
          id: crypto.randomUUID(),
          user_id: "",
          token: "",
          name: name.trim(),
          is_active: true,
          created_at: new Date().toISOString(),
          last_used_at: null,
        },
        ...prev,
      ]);
    }
  }

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete(id: string) {
    await deleteIrlToken(id);
    setList((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="space-y-6">
      {/* Add device card */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Add device</h2>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="e.g. My iPhone"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="max-w-xs"
          />
          <Button onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? "Generating…" : "Generate URL"}
          </Button>
        </div>

        {createError && (
          <p className="text-sm text-destructive">{createError}</p>
        )}

        {newUrl && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
            <p className="text-xs font-semibold text-primary">
              Collector URL — paste this into IRL Pro as a browser source.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background border rounded px-2 py-1.5 break-all">
                {newUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(newUrl)}
                className="shrink-0 gap-1.5"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            {/* Get it to your phone */}
            <div className="pt-1 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Get it to your phone:</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`mailto:?subject=IRL%20Collector%20URL&body=${encodeURIComponent(newUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
                    <Mail className="h-3 w-3" />
                    Email to myself
                  </Button>
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(newUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
                    <Share2 className="h-3 w-3" />
                    WhatsApp
                  </Button>
                </a>
                <a
                  href={`https://qrcode.show/${encodeURIComponent(newUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
                    <QrCode className="h-3 w-3" />
                    QR code
                  </Button>
                </a>
              </div>
              <p className="text-[11px] text-muted-foreground/60">
                Or use Apple Notes / Google Keep to send it to yourself — avoid messaging apps that auto-shorten links.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Token list */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 flex flex-col items-center justify-center gap-2 py-12 text-center">
          <Smartphone className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">No devices yet</p>
          <p className="text-xs text-muted-foreground/70">Add your first device above to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((token) => (
            <div
              key={token.id}
              className="rounded-xl border bg-card px-4 py-3 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{token.name}</span>
                    <Badge
                      variant="outline"
                      className="text-green-600 border-green-600/30 dark:text-green-400 shrink-0 text-[10px] px-1.5"
                    >
                      Active
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Added {new Date(token.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    {token.last_used_at && (
                      <> · Last used {new Date(token.last_used_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</>
                    )}
                  </p>
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete &quot;{token.name}&quot;?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will immediately revoke the collector URL. Any device using it will stop
                      publishing GPS data and cannot reconnect.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(token.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete device
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
