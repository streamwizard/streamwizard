"use client";

import { Sparkles } from "lucide-react";
import { Switch } from "@repo/ui";
import { Label } from "@repo/ui";

interface MemesStepProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function MemesStep({ value, onChange }: MemesStepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">We made some memes.</h2>
        <p className="text-sm text-muted-foreground">
          StreamWizard has memes. They're stupid. They're great. Turn them off if you're at work.
        </p>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          <Label className="text-sm font-medium">Memes</Label>
        </div>
        <Switch checked={value} onCheckedChange={onChange} />
      </div>
    </div>
  );
}
