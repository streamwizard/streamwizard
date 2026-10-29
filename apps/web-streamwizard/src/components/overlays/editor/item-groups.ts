import {
  isRootOverlayItemType,
  type OverlayItem,
  type OverlayItemGroup,
} from "@/types/overlays";

/**
 * Pure helpers for the editor's user groups (SW-236). No store access, and no
 * registry import, so the save action can use them on the server too.
 *
 * The model: a group is a named node with an optional parent group, and a root
 * item points at its innermost group through `group_id`. Clip display fields
 * are never grouped; they follow their clips widget.
 *
 * Layer order stays a flat z-index over root items. A group is only drawn as
 * one block in the layers panel if its items are contiguous in that order, so
 * every structural edit finishes with `normalizeLayerOrder`.
 */

export type LayerNode =
  | { kind: "group"; id: string }
  | { kind: "item"; id: string };

type GroupIndex = Map<string, OverlayItemGroup>;

export function indexGroups(groups: readonly OverlayItemGroup[]): GroupIndex {
  return new Map(groups.map((g) => [g.id, g]));
}

function rootItems(items: readonly OverlayItem[]): OverlayItem[] {
  return items.filter((i) => isRootOverlayItemType(i.type));
}

/** Root ids in layer order, top first. */
export function topFirstRootIds(items: readonly OverlayItem[]): string[] {
  return rootItems(items)
    .sort((a, b) => b.z_index - a.z_index)
    .map((i) => i.id);
}

/** The item's group, or null when it has none or points at a group that's gone. */
export function itemGroupId(item: OverlayItem, index: GroupIndex): string | null {
  return item.group_id && index.has(item.group_id) ? item.group_id : null;
}

function groupParentId(group: OverlayItemGroup, index: GroupIndex): string | null {
  return group.parent_group_id && index.has(group.parent_group_id)
    ? group.parent_group_id
    : null;
}

/** The group a node sits in directly, or null at the root. */
export function nodeParentId(
  node: LayerNode,
  items: readonly OverlayItem[],
  index: GroupIndex
): string | null {
  if (node.kind === "group") {
    const group = index.get(node.id);
    return group ? groupParentId(group, index) : null;
  }
  const item = items.find((i) => i.id === node.id);
  return item ? itemGroupId(item, index) : null;
}

/**
 * The chain of groups from the root down to `groupId`, outermost first and
 * including `groupId` itself. Stops at a cycle rather than looping, so a
 * damaged row can't hang the editor.
 */
export function groupChain(groupId: string | null, index: GroupIndex): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let current = groupId && index.has(groupId) ? groupId : null;
  while (current && !seen.has(current)) {
    seen.add(current);
    chain.unshift(current);
    current = groupParentId(index.get(current)!, index);
  }
  return chain;
}

/** Whether `groupId` is `ancestorId` or sits somewhere inside it. */
export function isWithinGroup(
  groupId: string | null,
  ancestorId: string,
  index: GroupIndex
): boolean {
  return groupChain(groupId, index).includes(ancestorId);
}

/** Every root item inside a group, at any depth. */
export function groupItemIds(
  groupId: string,
  items: readonly OverlayItem[],
  index: GroupIndex
): string[] {
  return rootItems(items)
    .filter((i) => isWithinGroup(itemGroupId(i, index), groupId, index))
    .map((i) => i.id);
}

/** The items a node stands for: itself, or everything in the group. */
export function nodeItemIds(
  node: LayerNode,
  items: readonly OverlayItem[],
  index: GroupIndex
): string[] {
  return node.kind === "item" ? [node.id] : groupItemIds(node.id, items, index);
}

/** A group is kept only while it holds at least one item, directly or deeper. */
export function pruneEmptyGroups(
  items: readonly OverlayItem[],
  groups: readonly OverlayItemGroup[]
): OverlayItemGroup[] {
  const index = indexGroups(groups);
  const used = new Set<string>();
  for (const item of rootItems(items)) {
    for (const id of groupChain(itemGroupId(item, index), index)) used.add(id);
  }
  if (used.size === groups.length) return groups as OverlayItemGroup[];
  return groups.filter((g) => used.has(g.id));
}

/**
 * The direct children of a container (a group, or null for the root), top
 * first. A child group sits where its topmost item does.
 */
export function orderedChildren(
  containerId: string | null,
  items: readonly OverlayItem[],
  groups: readonly OverlayItemGroup[]
): LayerNode[] {
  const index = indexGroups(groups);
  const order = topFirstRootIds(items);
  const byId = new Map(items.map((i) => [i.id, i]));

  // Walk the items top first and record, for this container, which child each
  // one falls under. The first time a child is seen is its position.
  const children: LayerNode[] = [];
  const seen = new Set<string>();
  for (const id of order) {
    const item = byId.get(id)!;
    const chain = groupChain(itemGroupId(item, index), index);
    let node: LayerNode | null = null;
    if (containerId === null) {
      node = chain.length > 0 ? { kind: "group", id: chain[0]! } : { kind: "item", id };
    } else {
      const at = chain.indexOf(containerId);
      if (at === -1) continue;
      node =
        at < chain.length - 1
          ? { kind: "group", id: chain[at + 1]! }
          : { kind: "item", id };
    }
    const key = `${node.kind}:${node.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    children.push(node);
  }
  return children;
}

/**
 * Top-first root ids with every group contiguous: each container lists its
 * children by where their topmost item is, then expands them depth first.
 * Optionally forces one container's children into a given order, which is how
 * a reorder in the layers panel is applied.
 */
export function normalizeLayerOrder(
  items: readonly OverlayItem[],
  groups: readonly OverlayItemGroup[],
  override?: { containerId: string | null; children: LayerNode[] }
): string[] {
  const out: string[] = [];
  const visited = new Set<string>();
  const expand = (containerId: string | null) => {
    // A cycle in damaged data would otherwise recurse forever.
    const guard = containerId ?? "";
    if (visited.has(guard)) return;
    visited.add(guard);
    const children =
      override && override.containerId === containerId
        ? override.children
        : orderedChildren(containerId, items, groups);
    for (const child of children) {
      if (child.kind === "item") out.push(child.id);
      else expand(child.id);
    }
  };
  expand(null);

  // Anything the walk couldn't reach (a cycle) keeps its place at the bottom
  // rather than vanishing from the order.
  const placed = new Set(out);
  for (const id of topFirstRootIds(items)) if (!placed.has(id)) out.push(id);
  return out;
}

/**
 * Breaks a selection into the biggest whole nodes it covers: an item stands
 * for its outermost group when every item of that group is selected.
 */
export function selectionNodes(
  selectedIds: readonly string[],
  items: readonly OverlayItem[],
  groups: readonly OverlayItemGroup[]
): LayerNode[] {
  const index = indexGroups(groups);
  const selected = new Set(selectedIds);
  const byId = new Map(items.map((i) => [i.id, i]));
  const nodes: LayerNode[] = [];
  const seen = new Set<string>();

  for (const id of selectedIds) {
    const item = byId.get(id);
    if (!item || !isRootOverlayItemType(item.type)) continue;
    let node: LayerNode = { kind: "item", id };
    for (const groupId of groupChain(itemGroupId(item, index), index)) {
      if (groupItemIds(groupId, items, index).every((m) => selected.has(m))) {
        node = { kind: "group", id: groupId };
        break;
      }
    }
    const key = `${node.kind}:${node.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    nodes.push(node);
  }
  return nodes;
}

/** The one group a selection is exactly, outermost if several match, or null. */
export function selectedGroupId(
  selectedIds: readonly string[],
  items: readonly OverlayItem[],
  groups: readonly OverlayItemGroup[]
): string | null {
  const nodes = selectionNodes(selectedIds, items, groups);
  return nodes.length === 1 && nodes[0]!.kind === "group" ? nodes[0]!.id : null;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/**
 * The node on `itemId`'s path one level inside `scope` (null = the root).
 */
function nodeBelow(
  item: OverlayItem,
  scope: string | null,
  index: GroupIndex
): LayerNode {
  const chain = groupChain(itemGroupId(item, index), index);
  const at = scope === null ? -1 : chain.indexOf(scope);
  return at + 1 < chain.length
    ? { kind: "group", id: chain[at + 1]! }
    : { kind: "item", id: item.id };
}

/**
 * What a plain click on an item's canvas box selects.
 *
 * Outside any group context that is the item's outermost group. Once the
 * selection sits inside a group (the streamer double-clicked into it), clicks
 * on that group's items pick siblings at that level instead, so they can work
 * inside the group without drilling in again for every item.
 */
export function clickSelection(
  itemId: string,
  selectedIds: readonly string[],
  items: readonly OverlayItem[],
  groups: readonly OverlayItemGroup[]
): string[] {
  const index = indexGroups(groups);
  const item = items.find((i) => i.id === itemId);
  if (!item) return [];
  const chain = groupChain(itemGroupId(item, index), index);

  // The deepest group on this item's path that holds the whole selection
  // without being exactly the selection: the level the streamer is working at.
  let scope: string | null = null;
  if (selectedIds.length > 0) {
    for (const groupId of chain) {
      const members = groupItemIds(groupId, items, index);
      const memberSet = new Set(members);
      if (!selectedIds.every((id) => memberSet.has(id))) break;
      if (sameSet(members, selectedIds)) break;
      scope = groupId;
    }
  }
  return nodeItemIds(nodeBelow(item, scope, index), items, index);
}

/**
 * What a double-click selects: one level deeper than the group that is
 * currently selected on this item's path. A plain item stays selected.
 */
export function drillSelection(
  itemId: string,
  selectedIds: readonly string[],
  items: readonly OverlayItem[],
  groups: readonly OverlayItemGroup[]
): string[] {
  const index = indexGroups(groups);
  const item = items.find((i) => i.id === itemId);
  if (!item) return [];
  const chain = groupChain(itemGroupId(item, index), index);

  for (let at = chain.length - 1; at >= 0; at--) {
    if (sameSet(groupItemIds(chain[at]!, items, index), selectedIds)) {
      return nodeItemIds(nodeBelow(item, chain[at]!, index), items, index);
    }
  }
  return clickSelection(itemId, selectedIds, items, groups);
}

/** Grows a set of item ids (a marquee catch) to whole outermost groups. */
export function expandToOutermostGroups(
  ids: readonly string[],
  items: readonly OverlayItem[],
  groups: readonly OverlayItemGroup[]
): string[] {
  if (groups.length === 0) return [...ids];
  const index = indexGroups(groups);
  const byId = new Map(items.map((i) => [i.id, i]));
  const out = new Set<string>();
  for (const id of ids) {
    const item = byId.get(id);
    if (!item) continue;
    const outer = groupChain(itemGroupId(item, index), index)[0];
    if (!outer) out.add(id);
    else for (const m of groupItemIds(outer, items, index)) out.add(m);
  }
  // Keep the caller's ids first so the primary selection doesn't jump.
  return [...ids.filter((id) => out.has(id)), ...[...out].filter((id) => !ids.includes(id))];
}

/** "Group N", one past the highest N already used. */
export function nextGroupLabel(groups: readonly OverlayItemGroup[]): string {
  let max = 0;
  for (const g of groups) {
    const match = /^Group (\d+)$/.exec(g.label);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `Group ${max + 1}`;
}

/** The deepest group every node shares, or null when they only share the root. */
function commonParent(
  nodes: readonly LayerNode[],
  items: readonly OverlayItem[],
  index: GroupIndex
): string | null {
  let common: string[] | null = null;
  for (const node of nodes) {
    const chain = groupChain(nodeParentId(node, items, index), index);
    if (common === null) {
      common = chain;
      continue;
    }
    let n = 0;
    while (n < common.length && n < chain.length && common[n] === chain[n]) n++;
    common = common.slice(0, n);
  }
  return common && common.length > 0 ? common[common.length - 1]! : null;
}

/** Re-parents one node. A group never moves into itself or its own subtree. */
function reparent(
  node: LayerNode,
  parentId: string | null,
  items: OverlayItem[],
  groups: OverlayItemGroup[]
): { items: OverlayItem[]; groups: OverlayItemGroup[] } {
  if (node.kind === "item") {
    return {
      items: items.map((i) => (i.id === node.id ? { ...i, group_id: parentId } : i)),
      groups,
    };
  }
  if (parentId !== null && isWithinGroup(parentId, node.id, indexGroups(groups))) {
    return { items, groups };
  }
  return {
    items,
    groups: groups.map((g) =>
      g.id === node.id ? { ...g, parent_group_id: parentId } : g
    ),
  };
}

/**
 * Wraps the nodes in a new group, placed inside the deepest group they all
 * share. Groups left empty by the move are dropped.
 */
export function wrapInGroup(
  nodes: readonly LayerNode[],
  items: readonly OverlayItem[],
  groups: readonly OverlayItemGroup[],
  group: { id: string; scene_id: string; label: string }
): { items: OverlayItem[]; groups: OverlayItemGroup[] } {
  const index = indexGroups(groups);
  const parent = commonParent(nodes, items, index);
  let next = {
    items: [...items],
    groups: [...groups, { ...group, parent_group_id: parent }],
  };
  for (const node of nodes) {
    next = reparent(node, group.id, next.items, next.groups);
  }
  return { items: next.items, groups: pruneEmptyGroups(next.items, next.groups) };
}

/** Removes the groups; whatever they held moves up to each group's parent. */
export function ungroup(
  groupIds: readonly string[],
  items: readonly OverlayItem[],
  groups: readonly OverlayItemGroup[]
): { items: OverlayItem[]; groups: OverlayItemGroup[] } {
  let nextItems = [...items];
  let nextGroups = [...groups];
  for (const groupId of groupIds) {
    const group = nextGroups.find((g) => g.id === groupId);
    if (!group) continue;
    const parent = groupParentId(group, indexGroups(nextGroups));
    nextItems = nextItems.map((i) =>
      i.group_id === groupId ? { ...i, group_id: parent } : i
    );
    nextGroups = nextGroups
      .filter((g) => g.id !== groupId)
      .map((g) => (g.parent_group_id === groupId ? { ...g, parent_group_id: parent } : g));
  }
  return { items: nextItems, groups: nextGroups };
}

/**
 * Moves a node into `targetId` (null = out to the root). Moving a group into
 * its own subtree is refused and returns the input unchanged.
 */
export function moveNodeToGroup(
  node: LayerNode,
  targetId: string | null,
  items: readonly OverlayItem[],
  groups: readonly OverlayItemGroup[]
): { items: OverlayItem[]; groups: OverlayItemGroup[] } {
  const next = reparent(node, targetId, [...items], [...groups]);
  return { items: next.items, groups: pruneEmptyGroups(next.items, next.groups) };
}

/**
 * Copies of the given groups and everything nested in them, under fresh ids
 * from `newId`. Each copied top group keeps its original's parent, so the
 * duplicate lands beside the original. Returns the old → new group id map the
 * duplicated items are re-pointed with.
 */
export function cloneGroupSubtrees(
  topGroupIds: readonly string[],
  groups: readonly OverlayItemGroup[],
  newId: () => string,
  label: (original: OverlayItemGroup) => string
): { groups: OverlayItemGroup[]; idMap: Map<string, string> } {
  const index = indexGroups(groups);
  const idMap = new Map<string, string>();
  const cloned: OverlayItemGroup[] = [];

  for (const topId of topGroupIds) {
    const subtree = groups.filter((g) => isWithinGroup(g.id, topId, index));
    for (const g of subtree) idMap.set(g.id, newId());
    for (const g of subtree) {
      const isTop = g.id === topId;
      cloned.push({
        ...g,
        id: idMap.get(g.id)!,
        label: isTop ? label(g) : g.label,
        parent_group_id: isTop
          ? g.parent_group_id
          : (idMap.get(g.parent_group_id ?? "") ?? g.parent_group_id),
      });
    }
  }
  return { groups: cloned, idMap };
}

/** The groups a node could be moved into: not itself, its subtree or its current parent. */
export function moveTargets(
  node: LayerNode,
  items: readonly OverlayItem[],
  groups: readonly OverlayItemGroup[]
): OverlayItemGroup[] {
  const index = indexGroups(groups);
  const parent = nodeParentId(node, items, index);
  return groups.filter((g) => {
    if (g.id === parent) return false;
    if (node.kind === "group" && isWithinGroup(g.id, node.id, index)) return false;
    return true;
  });
}

/**
 * Makes a groups payload safe to write: no duplicate ids, no parent that isn't
 * in the list, no cycles, no empty groups, and no item pointing at a group
 * that isn't kept. Groups come back parents first. Used by the save action on
 * whatever the editor sends, and by the editor when a scene loads.
 */
export function sanitizeGroups(
  items: readonly OverlayItem[],
  groups: readonly OverlayItemGroup[]
): { items: OverlayItem[]; groups: OverlayItemGroup[] } {
  const unique = new Map<string, OverlayItemGroup>();
  for (const g of groups) if (!unique.has(g.id)) unique.set(g.id, { ...g });

  for (const g of unique.values()) {
    if (g.parent_group_id && !unique.has(g.parent_group_id)) g.parent_group_id = null;
  }
  // Walk up from each group; reaching it again means a cycle, which is cut there.
  for (const g of unique.values()) {
    const seen = new Set<string>([g.id]);
    let current = g.parent_group_id;
    while (current) {
      if (seen.has(current)) {
        g.parent_group_id = null;
        break;
      }
      seen.add(current);
      current = unique.get(current)?.parent_group_id ?? null;
    }
  }

  const nextItems = items.map((i) => {
    const keep =
      isRootOverlayItemType(i.type) && !!i.group_id && unique.has(i.group_id);
    const group_id = keep ? i.group_id! : null;
    return (i.group_id ?? null) === group_id ? i : { ...i, group_id };
  });
  const kept = pruneEmptyGroups(nextItems, [...unique.values()]);

  const index = indexGroups(kept);
  const depth = (g: OverlayItemGroup) => groupChain(g.id, index).length;
  return { items: nextItems, groups: [...kept].sort((a, b) => depth(a) - depth(b)) };
}
