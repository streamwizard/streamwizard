"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@repo/ui";
import type { IngestOutputKey } from "@repo/supabase/queries/ingest/ingest";
import type { Scene } from "@repo/obs-web";
import { ObsSceneField } from "./obs-scene-field";
import { obsPullUrl } from "@/lib/obs/obs-irl";

interface AddIngestSourceDialogProps {
  /** The feed being added; null keeps the dialog closed. */
  ingestKey: IngestOutputKey | null;
  scenes: Scene[];
  currentScene: string | null;
  obsPullHost: string;
  onAddToScene: (sceneName: string, inputName: string, url: string) => Promise<void>;
  onClose: () => void;
  onAdded?: (key: IngestOutputKey, sceneName: string) => void;
}

// Names an ingest feed and drops it into a scene as a media source. Used on
// the cloud OBS dashboard and in the OBS viewer window's header.
export function AddIngestSourceDialog({
  ingestKey,
  scenes,
  currentScene,
  obsPullHost,
  onAddToScene,
  onClose,
  onAdded,
}: AddIngestSourceDialogProps) {
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const [sceneName, setSceneName] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fill the form each time the dialog opens for a feed.
  const keyId = ingestKey?.id ?? null;
  if (keyId !== openedFor) {
    setOpenedFor(keyId);
    if (ingestKey) {
      setSceneName(currentScene ?? scenes[0]?.sceneName ?? "");
      setSourceName(`Ingest - ${ingestKey.label}`);
    }
  }

  const handleConfirm = async () => {
    const trimmedName = sourceName.trim();
    if (!ingestKey || !sceneName || !trimmedName) return;
    setSubmitting(true);
    try {
      await onAddToScene(sceneName, trimmedName, obsPullUrl(obsPullHost, ingestKey.output_key));
      onAdded?.(ingestKey, sceneName);
      toast.success(`Added "${trimmedName}" to ${sceneName}`);
      onClose();
    } catch (err) {
      toast.error("Couldn't add that source", {
        description: err instanceof Error ? err.message : "Try again?",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={ingestKey !== null} onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add &ldquo;{ingestKey?.label}&rdquo; to a scene</DialogTitle>
          <DialogDescription>Your incoming signal from the ingest server. Name it, pick a scene.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ingest-source-name">Source name</Label>
            <Input
              id="ingest-source-name"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="e.g. Backup cam"
            />
          </div>

          <ObsSceneField scenes={scenes} value={sceneName} onChange={setSceneName} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!sceneName || !sourceName.trim() || submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Add to scene
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
