import { Skeleton } from "@repo/ui";

// Mixed indents so the skeleton reads as a folder tree, not a flat table.
const ROW_INDENTS = [0, 20, 20, 0, 20, 40, 0, 0, 20, 0];

export function FoldersOverviewSkeleton() {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="mt-3 h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      <ul className="list-none divide-y divide-border">
        {ROW_INDENTS.map((indent, index) => (
          <li
            key={index}
            className="flex items-center gap-2 py-3.5"
            style={{ paddingLeft: indent }}
          >
            <Skeleton className="size-4 shrink-0 rounded" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="ml-auto h-4 w-20" />
          </li>
        ))}
      </ul>
    </>
  );
}
