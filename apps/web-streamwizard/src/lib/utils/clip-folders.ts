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
