"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Plus, Radio } from "lucide-react";
import { Button } from "@repo/ui";
import { listOutputKeys } from "@/actions/irl/ingest-output-keys";
import type { IngestOutputKey } from "@repo/supabase/queries/ingest/ingest";
import type { Scene } from "@repo/obs-web";
import { AddIngestSourceDialog } from "./add-ingest-source-dialog";
import { IngestLiveStats } from "./ingest-live-stats";

interface ObsIngestSourcesProps {
  scenes: Scene[];
  currentScene: string | null;
  canInteract: boolean;
  onAddToScene: (sceneName: string, inputName: string, url: string) => Promise<void>;
  obsPullHost: string;
}

export function ObsIngestSources({
  scenes,
  currentScene,
  canInteract,
  onAddToScene,
  obsPullHost,
}: ObsIngestSourcesProps) {
  const [keys, setKeys] = useState<IngestOutputKey[] | null>(null);
  const [activeKey, setActiveKey] = useState<IngestOutputKey | null>(null);
  // Per-key, sticky confirmation of where it landed, since the toast alone
  // faded before the destination registered.
  const [addedTo, setAddedTo] = useState<Record<string, string>>({});

  useEffect(() => {
    listOutputKeys().then(({ data }) => setKeys(data ?? []));
  }, []);

  return (
    <div className="space-y-6">
      <IngestLiveStats />

      <div className="space-y-3 border-t pt-6">
        {keys === null ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center px-4">
            <Radio className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No incoming signal yet</p>
            <p className="text-xs text-muted-foreground/55 max-w-xs leading-relaxed">
              Create an ingest key above, then drop it into a scene here.
            </p>
          </div>
        ) : scenes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No scenes found</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground/70 leading-relaxed">
              Your incoming signal. Drop it into any scene as a media source.
            </p>

            <div className="space-y-2">
              {keys.map((key) => {
                const landedIn = addedTo[key.id];
                return (
                  <div key={key.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0 flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{key.label}</p>
                      {landedIn && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400 shrink-0">
                          <Check className="h-3 w-3" />
                          In {landedIn}
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canInteract}
                      onClick={() => setActiveKey(key)}
                      className="shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add source
                    </Button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <AddIngestSourceDialog
        ingestKey={activeKey}
        scenes={scenes}
        currentScene={currentScene}
        obsPullHost={obsPullHost}
        onAddToScene={onAddToScene}
        onClose={() => setActiveKey(null)}
        onAdded={(key, sceneName) => setAddedTo((prev) => ({ ...prev, [key.id]: sceneName }))}
      />
    </div>
  );
}
