"use client";

import { Clapperboard } from "lucide-react";
import { Switch } from "@repo/ui";
import { Label } from "@repo/ui";

interface SyncClipsStepProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function SyncClipsStep({ value, onChange }: SyncClipsStepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Auto-sync after streams?</h2>
        <p className="text-sm text-muted-foreground">
          When your stream ends, we pull in your new clips automatically. No manual sync, no forgetting. Just there when you open StreamWizard.
        </p>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div className="flex items-center gap-3">
          <Clapperboard className="h-5 w-5 text-muted-foreground" />
          <Label className="text-sm font-medium">Sync clips on stream end</Label>
        </div>
        <Switch checked={value} onCheckedChange={onChange} />
      </div>
    </div>
  );
}
