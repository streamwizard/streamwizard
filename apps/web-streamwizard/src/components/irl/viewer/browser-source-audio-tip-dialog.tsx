"use client";

import { Loader2 } from "lucide-react";
import { useReducedMotion } from "motion/react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";

type BrowserSourceAudioTipDialogProps = {
  /** The browser source without OBS audio; null keeps the dialog closed. */
  sourceName: string | null;
  fixing: boolean;
  onFix: () => void;
  onClose: () => void;
};

/**
 * One-time tip in the OBS viewer window: a browser source was added without
 * "Control audio via OBS". The clip is rendered in ../brand-motion
 * (`bun run render:how-to browser-source-audio`) and lives in public/how-to.
 */
export function BrowserSourceAudioTipDialog({ sourceName, fixing, onFix, onClose }: BrowserSourceAudioTipDialogProps) {
  const reducedMotion = useReducedMotion();

  return (
    <Dialog open={sourceName !== null} onOpenChange={(open) => !open && !fixing && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Your viewers can&apos;t hear &ldquo;{sourceName}&rdquo; yet</DialogTitle>
          <DialogDescription>
            Cloud OBS only streams sound that goes through OBS, and this source plays its sound around it. You might
            still hear it in this window, which is what makes this one sneaky.
          </DialogDescription>
        </DialogHeader>

        <video
          className="aspect-[16/10] w-full rounded-lg border bg-[#0a0a0a]"
          poster="/how-to/browser-source-audio.webp"
          autoPlay={!reducedMotion}
          controls={!!reducedMotion}
          loop
          muted
          playsInline
          aria-label="A browser source's properties open in OBS, Control audio via OBS is ticked, OK is clicked and the source shows up in the audio mixer."
        >
          <source src="/how-to/browser-source-audio.webm" type="video/webm" />
          <source src="/how-to/browser-source-audio.mp4" type="video/mp4" />
        </video>

        <p className="text-sm text-muted-foreground">
          Double-click the source, tick <span className="font-medium text-foreground">Control audio via OBS</span> and
          click OK. Or we flip it for you.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={fixing}>
            I&apos;ll do it myself
          </Button>
          <Button onClick={onFix} disabled={fixing}>
            {fixing && <Loader2 className="size-4 animate-spin" />}
            Turn it on for me
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
