"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@repo/ui";
import { copyToClipboard } from "@/lib/node-ui";

// The two pieces the OBS and ingest Manage tabs share: the one-time install
// command and the type-the-name delete confirm.

export function InstallCommandCard({
  command,
  description,
  onDismiss,
}: {
  command: string;
  description: string;
  onDismiss: () => void;
}) {
  return (
    <Card className="border-amber-500/50">
      <CardHeader>
        <CardTitle>Install command: copy it now</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* A long one-liner: it wraps and scrolls inside this box, never the page. */}
        <pre className="max-h-60 overflow-auto rounded-md bg-muted p-3 text-xs break-all whitespace-pre-wrap">{command}</pre>
        <div className="flex flex-wrap gap-2">
          <Button className="h-11 md:h-9" onClick={() => copyToClipboard(command, "Install command")}>
            <Copy aria-hidden="true" />
            Copy command
          </Button>
          <Button variant="outline" className="h-11 md:h-9" onClick={onDismiss}>
            I&apos;ve saved it
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface NamedNode {
  id: string;
  name: string;
}

export function DeleteNodeDialog({
  node,
  leftRunning,
  onClose,
  onDelete,
}: {
  /** The node being deleted; null keeps the dialog closed. */
  node: NamedNode | null;
  /** What keeps running on the box: "instances" or "sessions". */
  leftRunning: string;
  onClose: () => void;
  /** Resolves when the delete finished either way. The parent clears `node` on success. */
  onDelete: (id: string) => Promise<void>;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  // Keep the last node around so the text does not blank out while the dialog closes.
  const [shown, setShown] = useState(node);
  if (node && node !== shown) {
    setShown(node);
    setConfirmText("");
  }
  const name = shown?.name ?? "";

  return (
    <AlertDialog
      open={!!node}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this node?</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{name}&quot; will be removed. Any {leftRunning}{" "}
            already running on it aren&apos;t cleaned up by this action. This can&apos;t be undone. Type{" "}
            <span className="font-mono font-semibold break-all">{name}</span> to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          autoFocus
          aria-label="Node name"
          autoComplete="off"
          autoCapitalize="none"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={name}
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending || !node || confirmText !== node.name}
            onClick={async (e) => {
              // Stay open until the server answers, so a failure is not lost behind a closed dialog.
              e.preventDefault();
              if (!node) return;
              setPending(true);
              await onDelete(node.id);
              setPending(false);
            }}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
