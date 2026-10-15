import type { CmsAsset } from "@repo/supabase/queries/cms/assets";
import { cmsAssetFileName } from "./media";
import { cmsAssetUrl } from "./storage";

// Server-only: the media library's view of a cms_assets row.

export interface CmsMediaItem {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  alt: string;
  decorative: boolean;
  createdAt: string;
  /** Nothing uses it: safe to delete. */
  unused: boolean;
}

type AssetRow = Pick<
  CmsAsset,
  "id" | "key" | "mime_type" | "size_bytes" | "width" | "height" | "alt" | "is_decorative" | "created_at"
>;

export function toMediaItem(row: AssetRow, unused: boolean): CmsMediaItem {
  return {
    id: row.id,
    url: cmsAssetUrl(row.key),
    fileName: cmsAssetFileName(row.key),
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    alt: row.alt,
    decorative: row.is_decorative,
    createdAt: row.created_at,
    unused,
  };
}
