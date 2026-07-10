"use client";

import type { Scene, SceneItem } from "@/hooks/use-obs-websocket";
import type { AutoSwitcherConfigRow } from "@/actions/supabase/auto-switcher";
import { AutoSwitcherStatusCard } from "./auto-switcher-status-card";
import { AutoSwitcherOverrideControls } from "./auto-switcher-override-controls";
import { AutoSwitcherForm } from "./auto-switcher-form";
import { useAutoSwitcherStatus } from "./use-auto-switcher-status";

interface AutoSwitcherTabProps {
  initialConfig: AutoSwitcherConfigRow | null;
  scenes: Scene[];
  sceneItems: Record<string, SceneItem[]>;
  obsConnected: boolean;
}

export function AutoSwitcherTab({ initialConfig, scenes, sceneItems, obsConnected }: AutoSwitcherTabProps) {
  const { status } = useAutoSwitcherStatus();
  const enabled = initialConfig?.enabled ?? false;

  return (
    <div className="space-y-4">
      <AutoSwitcherStatusCard status={status} enabled={enabled} />
      <AutoSwitcherOverrideControls scenes={scenes} status={status} enabled={enabled} />
      <AutoSwitcherForm initialConfig={initialConfig} scenes={scenes} sceneItems={sceneItems} obsConnected={obsConnected} />
    </div>
  );
}
