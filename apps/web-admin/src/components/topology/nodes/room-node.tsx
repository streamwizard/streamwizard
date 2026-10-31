"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type RoomNodeData = {
  roomId: string;
  subscriberCount: number;
  isAnimating: boolean;
};

export const RoomNode = memo(function RoomNode({ data }: NodeProps) {
  const { roomId, subscriberCount, isAnimating } = data as RoomNodeData;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card px-4 py-3 shadow-md min-w-[160px] transition-shadow duration-300",
        isAnimating && "shadow-green-500/30 shadow-lg"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-2 !h-2" />

      <div className="font-mono text-xs text-muted-foreground mb-1.5">{roomId}</div>

      <div className="flex items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Users className="h-3 w-3" />
          {subscriberCount}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !w-2 !h-2" />
    </div>
  );
});
