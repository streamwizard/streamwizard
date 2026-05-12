import { Gamepad2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import type { TitleCategorySegment } from "./types";

function formatOffset(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

interface TitleCategoryHistoryProps {
  segments: TitleCategorySegment[];
}

export function TitleCategoryHistory({ segments }: TitleCategoryHistoryProps) {
  if (segments.length <= 1) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gamepad2 className="h-4 w-4" />
          Title &amp; category history
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative border-l border-border pl-5 space-y-4">
          {segments.map((seg, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[1.125rem] top-1 h-3 w-3 rounded-full border-2 border-background bg-muted-foreground/50" />
              <p className="font-mono text-xs text-muted-foreground">
                {formatOffset(seg.startSeconds)}
                {seg.endSeconds != null ? ` – ${formatOffset(seg.endSeconds)}` : " – end"}
              </p>
              {seg.gameName && (
                <p className="mt-0.5 text-xs font-semibold text-primary">{seg.gameName}</p>
              )}
              <p className="text-sm leading-snug line-clamp-2">{seg.title ?? "Untitled"}</p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
