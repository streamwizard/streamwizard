"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export type BotNodeData = {
  connected: boolean;
  connId: string | null;
  connectedAt: number | null;
};

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export const BotNode = memo(function BotNode({ data }: NodeProps) {
  const { connected, connId, connectedAt } = data as BotNodeData;

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 shadow-md min-w-[150px]",
        connected
          ? "border-purple-500/40 bg-purple-950/40"
          : "border-border bg-card"
      )}
    >
      <Handle type="source" position={Position.Bottom} className="!bg-purple-400 !w-2 !h-2" />

      <div className="flex items-center gap-2 mb-1">
        <Bot className={cn("h-4 w-4", connected ? "text-purple-400" : "text-muted-foreground")} />
        <span className={cn("text-sm font-semibold", connected ? "text-purple-200" : "text-muted-foreground")}>
          StreamWizard Bot
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className={cn(connected ? "text-purple-300" : "text-muted-foreground")}>
          {connected ? "Connected" : "Disconnected"}
        </span>
        {connected && connId && (
          <span className="text-muted-foreground font-mono">{connId}</span>
        )}
      </div>

      {connected && connectedAt && (
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {formatDuration(Date.now() - connectedAt)}
        </div>
      )}
    </div>
  );
});
