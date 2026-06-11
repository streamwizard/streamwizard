"use client";

import { ClipCardActions, useClipCardActions } from "@/components/cards/clip-card";
import { formatClipDuration, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CLIP_SORT_DEFAULT_ASC,
  type ClipSortKey,
  parseClipSortAscending,
  parseClipSortKey,
} from "@/lib/utils/clip-sort";
import { clipsWithFolders } from "@/types/database";
import { ArrowDown, ArrowUp, ArrowUpDown, Star } from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DETAILS_GRID =
  "grid grid-cols-[64px_minmax(200px,2.5fr)_minmax(110px,1fr)_minmax(110px,1fr)_80px_104px_72px_36px] items-center gap-x-3";

const SORT_COLUMNS: { key: ClipSortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "creator", label: "Creator" },
  { key: "game", label: "Game" },
  { key: "views", label: "Views" },
  { key: "date", label: "Date" },
  { key: "duration", label: "Duration" },
];

function SortHeader({
  label,
  column,
  isActive,
  ascending,
  onSort,
}: {
  label: string;
  column: ClipSortKey;
  isActive: boolean;
  ascending: boolean;
  onSort: (column: ClipSortKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn(
        "flex items-center gap-1 text-left uppercase transition-colors hover:text-foreground",
        isActive ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <span>{label}</span>
      {isActive ? (
        ascending ? (
          <ArrowUp className="size-3 shrink-0" aria-hidden />
        ) : (
          <ArrowDown className="size-3 shrink-0" aria-hidden />
        )
      ) : (
        <ArrowUpDown className="size-3 shrink-0 opacity-40" aria-hidden />
      )}
    </button>
  );
}

function ClipDetailsRow({ clip }: { clip: clipsWithFolders }) {
  const { OpenClip } = useClipCardActions(clip);

  return (
    <div
      onClick={OpenClip}
      className={cn(
        DETAILS_GRID,
        "group cursor-pointer border-b border-border/50 px-3 py-2 last:border-b-0 transition-colors hover:bg-accent/30"
      )}
    >
      <button
        type="button"
        onClick={OpenClip}
        className="relative h-10 w-16 shrink-0 overflow-hidden rounded border border-border bg-muted"
        aria-label={`Play clip: ${clip.title}`}
      >
        <Image
          src={clip.thumbnail_url!}
          alt=""
          width={64}
          height={40}
          className="h-full w-full object-cover"
        />
        {clip.is_featured && (
          <Star className="absolute top-0.5 right-0.5 size-3 fill-yellow-500 text-yellow-500" aria-hidden />
        )}
      </button>

      <button
        type="button"
        onClick={OpenClip}
        className="min-w-0 truncate text-left text-sm font-medium hover:underline"
        title={clip.title ?? undefined}
      >
        {clip.title}
      </button>

      <span className="truncate text-sm text-muted-foreground" title={clip.creator_name ?? undefined}>
        {clip.creator_name}
      </span>

      <span className="truncate text-sm text-muted-foreground" title={clip.game_name ?? undefined}>
        {clip.game_name ?? "—"}
      </span>

      <span className="text-sm tabular-nums text-muted-foreground">{clip.view_count?.toLocaleString() ?? "—"}</span>

      <span className="text-sm text-muted-foreground">{clip.created_at_twitch ? formatDate(clip.created_at_twitch) : "—"}</span>

      <span className="text-sm tabular-nums text-muted-foreground">
        {clip.duration != null ? formatClipDuration(clip.duration) : "—"}
      </span>

      <div
        onClick={(event) => event.stopPropagation()}
        className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
      >
        <ClipCardActions clip={clip} />
      </div>
    </div>
  );
}

type ClipsDetailsViewProps = {
  clips: clipsWithFolders[];
};

export function ClipsDetailsView({ clips }: ClipsDetailsViewProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const sortParam = searchParams.get("sort");
  const activeSort = parseClipSortKey(sortParam);
  const ascending = sortParam != null ? parseClipSortAscending(searchParams.get("asc")) : false;

  const handleSort = (column: ClipSortKey) => {
    const params = new URLSearchParams(searchParams);
    const currentSort = parseClipSortKey(sortParam);
    const currentAsc = sortParam != null ? parseClipSortAscending(searchParams.get("asc")) : false;

    if (currentSort === column) {
      params.set("sort", column);
      params.set("asc", currentAsc ? "false" : "true");
    } else {
      params.set("sort", column);
      params.set("asc", CLIP_SORT_DEFAULT_ASC[column] ? "true" : "false");
    }

    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card/50">
      <div className="overflow-x-auto">
        <div className="min-w-[880px]">
          <div
            className={cn(
              DETAILS_GRID,
              "border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium tracking-wide"
            )}
          >
            <span aria-hidden />
            {SORT_COLUMNS.map(({ key, label }) => {
              const isActive = sortParam ? activeSort === key : key === "date";

              return (
                <SortHeader
                  key={key}
                  label={label}
                  column={key}
                  isActive={isActive}
                  ascending={isActive ? ascending : false}
                  onSort={handleSort}
                />
              );
            })}
            <span aria-hidden />
          </div>

          {clips.map((clip) => (
            <ClipDetailsRow key={clip.id} clip={clip} />
          ))}
        </div>
      </div>
    </div>
  );
}
