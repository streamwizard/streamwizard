import { FoldersContent } from "@/components/clips/folders-content";
import { FoldersOverviewSkeleton } from "@/components/clips/folders-overview-skeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Folders - Clip folders",
  description: "Every clip folder and subfolder, and how many clips are in each",
};

export default function FoldersPage() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="rounded-xl border border-border bg-card/50 p-6 shadow-sm">
        <Suspense fallback={<FoldersOverviewSkeleton />}>
          <FoldersContent />
        </Suspense>
      </div>
    </div>
  );
}
