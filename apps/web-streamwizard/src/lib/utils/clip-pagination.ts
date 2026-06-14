export const CLIP_PAGE_SIZE_OPTIONS = [25, 50, 75, 100] as const;

export type ClipPageSize = (typeof CLIP_PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_CLIP_PAGE_SIZE: ClipPageSize = 25;

export function parseClipPageSize(per_page?: string): ClipPageSize {
  const parsed = per_page ? parseInt(per_page, 10) : DEFAULT_CLIP_PAGE_SIZE;
  return (CLIP_PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed)
    ? (parsed as ClipPageSize)
    : DEFAULT_CLIP_PAGE_SIZE;
}

export function getClipPageRange(pageIndex: number, pageSize: number, showingCount: number, totalCount: number) {
  if (totalCount === 0 || showingCount === 0) {
    return { from: 0, to: 0 };
  }

  const from = (pageIndex - 1) * pageSize + 1;
  const to = from + showingCount - 1;

  return { from, to };
}
