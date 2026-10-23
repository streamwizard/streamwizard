import { FoldersOverview, type FolderOverviewRow } from "@/components/clips/folders-overview";
import { FoldersOverviewSkeleton } from "@/components/clips/folders-overview-skeleton";
import { getAuthContext } from "@/lib/auth";
import {
  buildClipFolderTree,
  flattenClipFolderTree,
  rollupFolderClipCounts,
} from "@/lib/utils/clip-folders";
import { getClipFolderClipCounts, getClipFolders } from "@repo/supabase/queries/clips";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Folders - Clip folders",
  description: "Every clip folder and subfolder, and how many clips are in each",
};

async function FoldersContent() {
  const { supabase, user } = await getAuthContext();

  const [{ data: folders }, directCounts] = await Promise.all([
    getClipFolders(supabase, user.id),
    // A failed count degrades to "no numbers" instead of a blank page, the same
    // way the dashboard layout handles the sidebar badges.
    getClipFolderClipCounts(supabase, user.id).catch((err) => {
      console.error("Failed to count clips per folder:", err);
      return {} as Record<string, number>;
    }),
  ]);

  const tree = buildClipFolderTree(folders ?? []);
  const counts = rollupFolderClipCounts(tree, directCounts);
  const rows: FolderOverviewRow[] = flattenClipFolderTree(tree).map(({ folder, depth }) => ({
    id: folder.id,
    name: folder.name,
    href: folder.href,
    depth,
    hasSubfolders: folder.children.length > 0,
    count: counts[folder.id] ?? { direct: 0, total: 0 },
  }));

  return <FoldersOverview rows={rows} />;
}

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
