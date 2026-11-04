import { FoldersOverview, type FolderOverviewRow } from "@/components/clips/folders-overview";
import { getAuthContext } from "@/lib/auth";
import { reportError } from "@repo/sentry";
import {
  buildClipFolderTree,
  flattenClipFolderTree,
  rollupFolderClipCounts,
} from "@/lib/utils/clip-folders";
import { getClipFolderClipCounts, getClipFolders } from "@repo/supabase/queries/clips";

export async function FoldersContent() {
  const { supabase, user } = await getAuthContext();

  const [{ data: folders }, directCounts] = await Promise.all([
    getClipFolders(supabase, user.id),
    // A failed count degrades to "no numbers" instead of a blank page, the same
    // way the dashboard layout handles the sidebar badges.
    getClipFolderClipCounts(supabase, user.id).catch((err) => {
      reportError(err, "dashboard: folder clip counts");
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
