import { FoldersOverviewSkeleton } from "@/components/clips/folders-overview-skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="rounded-xl border border-border bg-card/50 p-6 shadow-sm">
        <FoldersOverviewSkeleton />
      </div>
    </div>
  );
}
