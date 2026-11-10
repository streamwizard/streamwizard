"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { z } from "zod";
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
import type { Scene } from "@repo/obs-web";
import { ObsSceneField } from "@/components/irl/obs-scene-field";
import type { BrowserSourceTarget } from "@/types/obs";

type AddBrowserSourceDialogProps = {
  /** What's being added; null keeps the dialog closed. */
  target: BrowserSourceTarget | null;
  scenes: Scene[];
  currentScene: string | null;
  onAddToScene: (
    sceneName: string,
    inputName: string,
    url: string,
    size: { width: number; height: number },
  ) => Promise<void>;
  onClose: () => void;
};

const formSchema = z.object({
  name: z.string().trim().min(1, "Give the source a name.").max(256, "That name is too long."),
  url: z
    .url({ protocol: /^https?$/, error: "Paste a full link that starts with https://" })
    .max(2048, "That link is too long."),
  width: z.coerce.number().int().min(1).max(4096, "Width goes up to 4096."),
  height: z.coerce.number().int().min(1).max(4096, "Height goes up to 4096."),
});

const DEFAULT_SIZE = { width: 1920, height: 1080 };

// Names a browser source, sizes it and drops it into a scene: either one of
// the user's StreamWizard overlays (link filled in for them) or any link.
export function AddBrowserSourceDialog({
  target,
  scenes,
  currentScene,
  onAddToScene,
  onClose,
}: AddBrowserSourceDialogProps) {
  const [openedFor, setOpenedFor] = useState<BrowserSourceTarget | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [sceneName, setSceneName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fill the form each time the dialog opens.
  if (target !== openedFor) {
    setOpenedFor(target);
    if (target) {
      const size = target.kind === "overlay" ? target : DEFAULT_SIZE;
      setName(target.kind === "overlay" ? target.name : "");
      setUrl(target.kind === "overlay" ? target.url : "");
      setWidth(String(size.width));
      setHeight(String(size.height));
      setSceneName(currentScene ?? scenes[0]?.sceneName ?? "");
      setFormError(null);
    }
  }

  const custom = target?.kind === "custom";

  const handleConfirm = async () => {
    const parsed = formSchema.safeParse({ name, url: url.trim(), width, height });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the fields and try again.");
      return;
    }
    if (!sceneName) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const { name: inputName, url: sourceUrl, width: w, height: h } = parsed.data;
      await onAddToScene(sceneName, inputName, sourceUrl, { width: w, height: h });
      toast.success(`Added "${inputName}" to ${sceneName}`);
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
    <Dialog open={target !== null} onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {target?.kind === "overlay" ? <>Add &ldquo;{target.name}&rdquo; to a scene</> : "Add a browser source"}
          </DialogTitle>
          <DialogDescription>
            {custom
              ? "Any web page or widget link, like an alert box or a chat overlay."
              : "Your StreamWizard overlay, at the size you made it."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="browser-source-name">Source name</Label>
            <Input
              id="browser-source-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alerts"
            />
          </div>

          {custom && (
            <div className="space-y-2">
              <Label htmlFor="browser-source-url">Link</Label>
              <Input
                id="browser-source-url"
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="browser-source-width">Width</Label>
              <Input
                id="browser-source-width"
                type="number"
                min={1}
                max={4096}
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="browser-source-height">Height</Label>
              <Input
                id="browser-source-height"
                type="number"
                min={1}
                max={4096}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
          </div>

          <ObsSceneField scenes={scenes} value={sceneName} onChange={setSceneName} />

          {target?.kind === "overlay" && !target.active && (
            <p className="text-sm text-amber-500">
              This overlay is turned off, so it stays empty in OBS until you turn it on under Overlays.
            </p>
          )}

          {formError && <p className="text-sm text-destructive">{formError}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!sceneName || submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Add to scene
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
