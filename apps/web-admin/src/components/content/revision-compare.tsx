import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui";
import { PageHeader } from "@/components/widgets/page-header";
import type { DiffLine } from "@/lib/cms/revision-diff";
import { REVISION_KIND_LABELS } from "@/lib/cms/revision-kinds";
import { PageCrumb } from "@/lib/crumbs";
import { formatDateTime, formatRelativeTime } from "@/lib/discord/tickets";
import { cn } from "@/lib/utils";
import { RestoreButton, type RevisionRow } from "./revision-list";

// One revision next to the current draft: per field, what was there then
// (red) and what's there now (green). Long stretches nothing changed in fold
// down to a count, with a line of context on either side.

const CONTEXT = 1;

type Chunk = { kind: "lines"; lines: DiffLine[] } | { kind: "skipped"; count: number };

function chunk(lines: DiffLine[]): Chunk[] {
  const near = lines.map((_, index) =>
    lines.slice(Math.max(0, index - CONTEXT), index + CONTEXT + 1).some((line) => line.kind !== "same"),
  );
  const chunks: Chunk[] = [];
  lines.forEach((line, index) => {
    const last = chunks[chunks.length - 1];
    if (near[index]) {
      if (last?.kind === "lines") last.lines.push(line);
      else chunks.push({ kind: "lines", lines: [line] });
    } else if (last?.kind === "skipped") last.count++;
    else chunks.push({ kind: "skipped", count: 1 });
  });
  return chunks;
}

const MARK = {
  removed: { sign: "−", label: "Removed:", row: "bg-destructive/10" },
  added: { sign: "+", label: "Added:", row: "bg-emerald-500/10" },
  same: { sign: "", label: "", row: "" },
} as const;

function Line({ line }: { line: DiffLine }) {
  if (line.kind === "changed") {
    return (
      <li className="flex gap-3 bg-amber-500/5 px-4 py-1.5">
        <span aria-hidden className="w-3 shrink-0 text-muted-foreground">
          ~
        </span>
        <p className="min-w-0 whitespace-pre-wrap break-words">
          <span className="sr-only">Changed: </span>
          {line.parts.map((part, index) =>
            part.kind === "removed" ? (
              <del key={index} className="rounded-sm bg-destructive/20 decoration-destructive/70">
                <span className="sr-only">removed </span>
                {part.text}
              </del>
            ) : part.kind === "added" ? (
              <ins key={index} className="rounded-sm bg-emerald-500/25 no-underline">
                <span className="sr-only">added </span>
                {part.text}
              </ins>
            ) : (
              <span key={index}>{part.text}</span>
            ),
          )}
        </p>
      </li>
    );
  }
  const mark = MARK[line.kind];
  return (
    <li className={cn("flex gap-3 px-4 py-1.5", mark.row, line.kind === "same" && "text-muted-foreground")}>
      <span aria-hidden className="w-3 shrink-0 text-muted-foreground">
        {mark.sign}
      </span>
      <p
        className={cn(
          "min-w-0 whitespace-pre-wrap break-words",
          line.kind === "removed" && "line-through decoration-destructive/50",
        )}
      >
        {mark.label && <span className="sr-only">{mark.label} </span>}
        {line.text}
      </p>
    </li>
  );
}

export function RevisionCompare({
  contentId,
  title,
  lockVersion,
  revision,
  changes,
}: {
  contentId: string;
  title: string;
  lockVersion: number;
  revision: RevisionRow;
  changes: { label: string; lines: DiffLine[] }[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageCrumb label={title} href={`/content/${contentId}`} />
      <PageCrumb label="Revisions" href={`/content/${contentId}/revisions`} />
      <PageCrumb label="Compare" href={`/content/${contentId}/revisions/${revision.id}`} />
      <PageHeader
        title="Compare with the draft"
        description={`${REVISION_KIND_LABELS[revision.kind]}, ${formatRelativeTime(revision.createdAt)} (${formatDateTime(revision.createdAt)}). Red was in that version, green is in the draft now.`}
      >
        <Button variant="ghost" size="sm" className="h-11 md:h-8" asChild>
          <Link href={`/content/${contentId}/revisions`}>
            <ArrowLeft aria-hidden />
            All revisions
          </Link>
        </Button>
        <RestoreButton contentId={contentId} lockVersion={lockVersion} revision={revision} />
      </PageHeader>

      {changes.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Check />
            </EmptyMedia>
            <EmptyTitle>Same as the draft</EmptyTitle>
            <EmptyDescription>
              The text in this version matches the draft. Settings like tags or images may still differ.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        changes.map((field) => (
          <Card key={field.label} className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-sm">{field.label}</CardTitle>
            </CardHeader>
            <CardContent className="px-0 text-sm leading-6">
              {chunk(field.lines).map((part, index) =>
                part.kind === "skipped" ? (
                  <p key={index} className="border-y bg-muted/40 px-4 py-1 text-xs text-muted-foreground">
                    {part.count} unchanged {part.count === 1 ? "line" : "lines"}
                  </p>
                ) : (
                  <ul key={index}>
                    {part.lines.map((line, lineIndex) => (
                      <Line key={lineIndex} line={line} />
                    ))}
                  </ul>
                ),
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
