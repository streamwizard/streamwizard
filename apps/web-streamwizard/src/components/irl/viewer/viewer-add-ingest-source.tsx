"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui";
import type { IngestOutputKey } from "@repo/supabase/queries/ingest/ingest";
import type { useObsWebSocket } from "@repo/obs-web";
import { listOutputKeys } from "@/actions/irl/ingest-output-keys";
import { AddIngestSourceDialog } from "@/components/irl/add-ingest-source-dialog";

type ViewerAddIngestSourceProps = {
  obs: ReturnType<typeof useObsWebSocket>;
  canInteract: boolean;
  obsPullHost: string;
};

// "Add IRL feed" in the OBS viewer window's header: pick an ingest feed, then the
// same name-and-scene dialog as the dashboard's Ingest list.
export function ViewerAddIngestSource({ obs, canInteract, obsPullHost }: ViewerAddIngestSourceProps) {
  const [keys, setKeys] = useState<IngestOutputKey[] | null>(null);
  const [activeKey, setActiveKey] = useState<IngestOutputKey | null>(null);

  useEffect(() => {
    listOutputKeys().then(({ data }) => setKeys(data ?? []));
  }, []);

  const ready = canInteract && obs.status === "open" && obs.scenes.length > 0;
  const title = !canInteract
    ? "Your plan is read-only right now"
    : obs.status !== "open"
      ? "Waiting for OBS to connect"
      : "Add an IRL feed to a scene";

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
            <Plus className="size-3.5" />
            Add IRL feed
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Your feeds</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {keys === null ? (
            <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
          ) : keys.length === 0 ? (
            <DropdownMenuItem asChild>
              <Link href="/dashboard/irl/ingest" target="_blank" rel="noopener">
                Make an ingest key first
              </Link>
            </DropdownMenuItem>
          ) : (
            keys.map((key) => (
              <DropdownMenuItem key={key.id} onSelect={() => setActiveKey(key)}>
                <span className="truncate">{key.label}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AddIngestSourceDialog
        ingestKey={activeKey}
        scenes={obs.scenes}
        currentScene={obs.currentScene}
        obsPullHost={obsPullHost}
        onAddToScene={obs.addMediaSourceToScene}
        onClose={() => setActiveKey(null)}
      />
    </>
  );
}
