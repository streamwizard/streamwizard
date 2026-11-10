"use client";

import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import type { Scene } from "@repo/obs-web";

type ObsSceneFieldProps = {
  scenes: Scene[];
  value: string;
  onChange: (sceneName: string) => void;
};

// The "Scene" picker in the dialogs that add a source to OBS.
export function ObsSceneField({ scenes, value, onChange }: ObsSceneFieldProps) {
  return (
    <div className="space-y-2">
      <Label>Scene</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose a scene" />
        </SelectTrigger>
        <SelectContent>
          {scenes.map((s) => (
            <SelectItem key={s.sceneName} value={s.sceneName}>
              {s.sceneName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
