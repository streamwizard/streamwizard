import type { AssetKind } from "@/lib/media/asset-mime";

/** One ready file in the user's media library, with its CDN URL. */
export interface UserAsset {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  kind: AssetKind;
  url: string;
  created_at: string;
}

export interface AssetListing {
  files: UserAsset[];
  used_bytes: number;
  quota_bytes: number;
}
