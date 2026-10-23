import { folderHrefToUrlPath, urlPathToFolderHref } from "@repo/supabase/queries/clips";
import type { Database } from "@repo/supabase";

export type ClipFolderRow = Database["public"]["Tables"]["clip_folders"]["Row"];

export type ClipFolderNode = ClipFolderRow & {
  children: ClipFolderNode[];
};

export function buildClipFolderTree(folders: ClipFolderRow[]): ClipFolderNode[] {
  const nodes = new Map<string, ClipFolderNode>();

  for (const folder of folders) {
    nodes.set(folder.id, { ...folder, children: [] });
  }

  const roots: ClipFolderNode[] = [];

  for (const folder of folders) {
    const node = nodes.get(folder.id)!;

    if (folder.parent_folder_id && nodes.has(folder.parent_folder_id)) {
      nodes.get(folder.parent_folder_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (items: ClipFolderNode[]) => {
    items.sort((a, b) => a.name.localeCompare(b.name));
    items.forEach((item) => sortNodes(item.children));
  };

  sortNodes(roots);
  return roots;
}

export type FolderClipCount = {
  /** Clips filed in this exact folder. */
  direct: number;
  /** Clips in this folder plus everything in its subfolders. */
  total: number;
};

/**
 * Roll up per-folder clip counts over the tree, keyed by folder id.
 *
 * Caveat: `total` sums the direct counts of a folder and its descendants, so a
 * clip filed in BOTH a folder and one of its subfolders is counted twice. The
 * number reads high, never low, and leaf folders are always exact. Making it
 * exact needs a recursive count(distinct clip_id) in SQL, which is only worth
 * the migration once a folder page actually lists its subfolders' clips.
 */
export function rollupFolderClipCounts(
  nodes: ClipFolderNode[],
  directCounts: Record<string, number>
): Record<string, FolderClipCount> {
  const counts: Record<string, FolderClipCount> = {};

  const walk = (node: ClipFolderNode): number => {
    const direct = directCounts[node.id] ?? 0;
    const total = direct + node.children.reduce((sum, child) => sum + walk(child), 0);
    counts[node.id] = { direct, total };
    return total;
  };

  nodes.forEach(walk);
  return counts;
}

/** Depth-first flattening of the folder tree, keeping each folder's nesting depth. */
export function flattenClipFolderTree(
  nodes: ClipFolderNode[],
  depth = 0
): { folder: ClipFolderNode; depth: number }[] {
  return nodes.flatMap((folder) => [
    { folder, depth },
    ...flattenClipFolderTree(folder.children, depth + 1),
  ]);
}

/** One wording for clip counts, so the sidebar and the overview page never drift apart. */
export function formatFolderClipCount(count: FolderClipCount): { label: string; aria: string } {
  const { direct, total } = count;
  const clips = (value: number) => `${value} ${value === 1 ? "clip" : "clips"}`;

  if (total === 0) return { label: "Empty", aria: "No clips" };
  if (total === direct) return { label: clips(direct), aria: clips(direct) };

  return {
    label: `${clips(direct)} \u00b7 ${total} total`,
    aria: `${clips(direct)}, ${total} including subfolders`,
  };
}

export function getFolderUrl(href: string): string {
  return `/dashboard/clips/${folderHrefToUrlPath(href)}`;
}

/** Resolve a folder from URL segments, tolerating legacy href values that omit parent paths. */
export function findFolderByUrlSegments(
  segments: string[],
  folders: ClipFolderRow[]
): ClipFolderRow | undefined {
  if (segments.length === 0) return undefined;

  const hrefFromUrl = urlPathToFolderHref(segments.join("/"));
  const byHref = folders.find((folder) => folder.href === hrefFromUrl);
  if (byHref) return byHref;

  const pathNames = segments.map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });

  return folders.find((folder) => {
    const names = getFolderBreadcrumb(folder, folders).map((item) => item.name);
    return names.length === pathNames.length && names.every((name, index) => name === pathNames[index]);
  });
}

export function getActiveFolderHref(pathname: string, folders?: ClipFolderRow[]): string | null {
  const prefix = "/dashboard/clips/";
  if (!pathname.startsWith(prefix)) return null;

  const rest = pathname.slice(prefix.length);
  if (!rest) return null;

  if (folders?.length) {
    const segments = rest.split("/").filter(Boolean);
    return findFolderByUrlSegments(segments, folders)?.href ?? urlPathToFolderHref(rest);
  }

  return urlPathToFolderHref(rest);
}

export function getFolderDepth(folder: ClipFolderRow, folders: ClipFolderRow[]): number {
  let depth = 0;
  let parentId = folder.parent_folder_id;

  while (parentId) {
    depth += 1;
    const parent = folders.find((item) => item.id === parentId);
    if (!parent) break;
    parentId = parent.parent_folder_id;
  }

  return depth;
}

export function getFolderDisplayName(folder: ClipFolderRow, folders: ClipFolderRow[]): string {
  return getFolderBreadcrumb(folder, folders)
    .map((item) => item.name)
    .join(" / ");
}

export function getFolderBreadcrumb(folder: ClipFolderRow, folders: ClipFolderRow[]): ClipFolderRow[] {
  const trail: ClipFolderRow[] = [folder];
  let parentId = folder.parent_folder_id;

  while (parentId) {
    const parent = folders.find((item) => item.id === parentId);
    if (!parent) break;
    trail.unshift(parent);
    parentId = parent.parent_folder_id;
  }

  return trail;
}
