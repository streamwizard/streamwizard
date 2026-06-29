"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@repo/ui";
import { Trash2, ChevronDown, ChevronRight } from "lucide-react";
import type { ObsLogEntry } from "@/hooks/use-obs-websocket";

const OP_COLORS: Record<string, string> = {
  Hello: "text-blue-400",
  Identify: "text-yellow-400",
  Identified: "text-green-400",
  Event: "text-purple-400",
  Request: "text-cyan-400",
  RequestResponse: "text-cyan-300",
};

function LogRow({ entry }: { entry: ObsLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const color = OP_COLORS[entry.opName] ?? "text-muted-foreground";
  const time = entry.timestamp.toLocaleTimeString("en-GB", { hour12: false }) +
    "." + String(entry.timestamp.getMilliseconds()).padStart(3, "0");

  return (
    <div className="font-mono text-xs border-b border-border/40 last:border-0">
      <button
        className="w-full flex items-start gap-2 px-3 py-1.5 hover:bg-muted/40 text-left"
        onClick={() => setExpanded((p) => !p)}
      >
        <span className="text-muted-foreground/60 shrink-0 w-[88px]">{time}</span>
        <span className={`shrink-0 w-[120px] font-medium ${color}`}>{entry.opName}</span>
        <span className="text-muted-foreground truncate flex-1 text-left">
          {summarise(entry.data)}
        </span>
        <span className="shrink-0 text-muted-foreground/40 ml-1">
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
      </button>
      {expanded && (
        <pre className="px-3 pb-2 text-[11px] text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all bg-muted/20">
          {JSON.stringify(entry.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function summarise(data: unknown): string {
  if (!data || typeof data !== "object") return String(data ?? "");
  const d = data as Record<string, unknown>;
  if (d.eventType) return String(d.eventType);
  if (d.requestType) return String(d.requestType);
  if (d.negotiatedRpcVersion) return `rpc v${d.negotiatedRpcVersion}`;
  const keys = Object.keys(d).slice(0, 3);
  return keys.map((k) => `${k}: ${JSON.stringify(d[k])}`).join(", ");
}

interface Props {
  entries: ObsLogEntry[];
  onClear: () => void;
}

export function ObsMessageLog({ entries, onClear }: Props) {
  const topRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll) topRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries, autoScroll]);

  return (
    <div className="flex flex-col h-[420px]">
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{entries.length} messages</span>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              className="h-3 w-3"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>
        </div>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onClear}>
          <Trash2 className="h-3 w-3 mr-1" />
          Clear
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No messages yet — connect to OBS to start seeing traffic.
          </p>
        ) : (
          <>
            <div ref={topRef} />
            {entries.map((entry) => (
              <LogRow key={entry.id} entry={entry} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
