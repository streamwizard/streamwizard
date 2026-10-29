"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui";
import { useReducedMotion } from "motion/react";
import Link from "next/link";

/**
 * "How do I add clips to a folder?" on an empty folder. Plays a short looping
 * clip of the clip card menu. The clip is rendered in ../brand-motion
 * (`bun run render:how-to`) and lives in public/how-to.
 */
export function AddClipsHelpDialog() {
  const reducedMotion = useReducedMotion();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">How do I add clips to a folder?</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add a clip to a folder</DialogTitle>
          <DialogDescription>
            Open the ••• menu on any clip, hover Add to folder, then pick the folder.
          </DialogDescription>
        </DialogHeader>
        <video
          className="aspect-[16/10] w-full rounded-lg border bg-[#0a0a0a]"
          poster="/how-to/add-clip-to-folder.webp"
          autoPlay={!reducedMotion}
          controls={!!reducedMotion}
          loop
          muted
          playsInline
          aria-label="A clip card's ••• menu is opened, Add to folder is hovered and a folder is picked."
        >
          <source src="/how-to/add-clip-to-folder.webm" type="video/webm" />
          <source src="/how-to/add-clip-to-folder.mp4" type="video/mp4" />
        </video>
        <DialogFooter>
          <Button asChild>
            <Link href="/dashboard/clips">Go to all clips</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
