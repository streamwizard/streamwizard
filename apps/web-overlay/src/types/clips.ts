/**
 * Position in a sequential clip rotation: the sort column's value on the clip
 * that just played, plus its id as tiebreak. Keyset rather than offset so
 * clips synced mid-stream slot into place instead of shifting everything
 * after them.
 */
export type ClipCursor = {
  sortValue: string | number | null;
  clipId: string;
};
