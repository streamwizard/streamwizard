"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Globe, Link2 } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui";
import type { useObsWebSocket } from "@repo/obs-web";
import { listOverlaysForObsSource } from "@/actions/overlays/scenes";
import { env } from "@/lib/env";
import type { BrowserSourceTarget } from "@/types/obs";
import { AddBrowserSourceDialog } from "./add-browser-source-dialog";

type ViewerAddBrowserSourceProps = {
  obs: ReturnType<typeof useObsWebSocket>;
  canInteract: boolean;
};

type OverlayOption = NonNullable<Awaited<ReturnType<typeof listOverlaysForObsSource>>["data"]>[number];

// "Add browser source" in the OBS viewer window's header: one of the user's
// StreamWizard overlays, or any link they paste.
export function ViewerAddBrowserSource({ obs, canInteract }: ViewerAddBrowserSourceProps) {
  const [overlays, setOverlays] = useState<OverlayOption[] | null>(null);
  const [target, setTarget] = useState<BrowserSourceTarget | null>(null);

  useEffect(() => {
    listOverlaysForObsSource().then(({ data }) => setOverlays(data ?? []));
  }, []);

  const ready = canInteract && obs.status === "open" && obs.scenes.length > 0;
  const title = !canInteract
    ? "Your plan is read-only right now"
    : obs.status !== "open"
      ? "Waiting for OBS to connect"
      : "Add an overlay or any web page to a scene";

  const pickOverlay = (overlay: OverlayOption) =>
    setTarget({
      kind: "overlay",
      name: overlay.name,
      url: `${env.NEXT_PUBLIC_OVERLAY_URL}/${overlay.slug}`,
      width: overlay.width,
      height: overlay.height,
      active: overlay.is_active,
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 px-2 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            disabled={!ready}
            title={title}
          >
            <Globe className="size-3.5" />
            Add browser source
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Your overlays</DropdownMenuLabel>
          {overlays === null ? (
            <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
          ) : overlays.length === 0 ? (
            <DropdownMenuItem asChild>
              <Link href="/dashboard/overlays" target="_blank" rel="noopener">
                Make your first overlay
              </Link>
            </DropdownMenuItem>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {overlays.map((overlay) => (
                <DropdownMenuItem key={overlay.id} onSelect={() => pickOverlay(overlay)}>
                  <span className="min-w-0 flex-1 truncate">{overlay.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {overlay.is_active ? `${overlay.width}×${overlay.height}` : "Off"}
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setTarget({ kind: "custom" })}>
            <Link2 className="size-4" />
            Custom link…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AddBrowserSourceDialog
        target={target}
        scenes={obs.scenes}
        currentScene={obs.currentScene}
        onAddToScene={obs.addBrowserSourceToScene}
        onClose={() => setTarget(null)}
      />
    </>
  );
}
