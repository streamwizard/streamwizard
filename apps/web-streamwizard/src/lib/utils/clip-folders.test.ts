import { expect, test } from "bun:test";
import {
  buildClipFolderTree,
  flattenClipFolderTree,
  formatFolderClipCount,
  rollupFolderClipCounts,
  type ClipFolderRow,
} from "./clip-folders";

function makeFolder(id: string, name: string, parentId: string | null = null): ClipFolderRow {
  return {
    id,
    name,
    parent_folder_id: parentId,
    href: name.toLowerCase(),
    user_id: "user-1",
    created_at: null,
    updated_at: null,
  };
}

test("rollupFolderClipCounts counts flat folders as direct only", () => {
  const tree = buildClipFolderTree([makeFolder("a", "Alpha"), makeFolder("b", "Beta")]);

  const counts = rollupFolderClipCounts(tree, { a: 3, b: 0 });

  expect(counts).toEqual({
    a: { direct: 3, total: 3 },
    b: { direct: 0, total: 0 },
  });
});

test("rollupFolderClipCounts rolls a child's clips up into its parent", () => {
  const tree = buildClipFolderTree([makeFolder("parent", "Games"), makeFolder("child", "Fortnite", "parent")]);

  const counts = rollupFolderClipCounts(tree, { child: 12 });

  expect(counts.parent).toEqual({ direct: 0, total: 12 });
  expect(counts.child).toEqual({ direct: 12, total: 12 });
});

test("rollupFolderClipCounts rolls up through three levels", () => {
  const tree = buildClipFolderTree([
    makeFolder("l1", "Games"),
    makeFolder("l2", "Fortnite", "l1"),
    makeFolder("l3", "Wins", "l2"),
  ]);

  const counts = rollupFolderClipCounts(tree, { l1: 1, l2: 2, l3: 4 });

  expect(counts.l1).toEqual({ direct: 1, total: 7 });
  expect(counts.l2).toEqual({ direct: 2, total: 6 });
  expect(counts.l3).toEqual({ direct: 4, total: 4 });
});

// Pins the documented caveat: the rollup sums direct counts, so a clip filed in
// both a parent and its child is counted twice. The total reads high, never low.
test("rollupFolderClipCounts double counts a clip filed in both a parent and its child", () => {
  const tree = buildClipFolderTree([makeFolder("parent", "Games"), makeFolder("child", "Fortnite", "parent")]);

  const counts = rollupFolderClipCounts(tree, { parent: 1, child: 1 });

  expect(counts.parent.total).toBe(2);
});

test("rollupFolderClipCounts treats missing counts as zero", () => {
  const tree = buildClipFolderTree([makeFolder("a", "Alpha"), makeFolder("b", "Beta", "a")]);

  const counts = rollupFolderClipCounts(tree, {});

  expect(counts).toEqual({
    a: { direct: 0, total: 0 },
    b: { direct: 0, total: 0 },
  });
});

test("flattenClipFolderTree returns depth-first order with nesting depth", () => {
  const tree = buildClipFolderTree([
    makeFolder("games", "Games"),
    makeFolder("fortnite", "Fortnite", "games"),
    makeFolder("wins", "Wins", "fortnite"),
    makeFolder("irl", "IRL"),
  ]);

  const rows = flattenClipFolderTree(tree);

  expect(rows.map((row) => [row.folder.name, row.depth])).toEqual([
    ["Games", 0],
    ["Fortnite", 1],
    ["Wins", 2],
    ["IRL", 0],
  ]);
});

test("formatFolderClipCount labels an empty folder", () => {
  expect(formatFolderClipCount({ direct: 0, total: 0 })).toEqual({ label: "Empty", aria: "No clips" });
});

test("formatFolderClipCount hides the total when it matches the direct count", () => {
  expect(formatFolderClipCount({ direct: 1, total: 1 }).label).toBe("1 clip");
  expect(formatFolderClipCount({ direct: 12, total: 12 }).label).toBe("12 clips");
});

test("formatFolderClipCount shows the rolled-up total when subfolders add clips", () => {
  const { label, aria } = formatFolderClipCount({ direct: 0, total: 12 });

  expect(label).toBe("0 clips · 12 total");
  expect(aria).toBe("0 clips, 12 including subfolders");
});
